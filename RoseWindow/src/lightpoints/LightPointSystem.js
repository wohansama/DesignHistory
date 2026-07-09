// LightPointSystem — the Interactive Light Point System (ILPS).
//
// This is the artwork itself (Tech Spec §4.2). The physical GLB is sampled for
// geometry + color, then hidden; the points become the rose window.
//
// Pipeline:
//   generate()  →  sample positions/normals/UVs from each mesh (MeshSurfaceSampler)
//                →  look up colors from material textures by UV (TextureColorSampler)
//                →  transform to world space (model is already placed by RoseWindowModel)
//                →  build ONE BufferGeometry + ShaderMaterial + THREE.Points
//   update()    →  push player position + time as uniforms (shader does the rest)
//
// All displacement / idle / recovery logic lives in PointShader.js (GPU).

import * as THREE from 'three';
import { MeshSurfaceSampler } from 'three/addons/math/MeshSurfaceSampler.js';
import { CONFIG } from '../config/Config.js';
import { TextureColorSampler } from './TextureColorSampler.js';
import { POINT_VERTEX_SHADER, POINT_FRAGMENT_SHADER } from './PointShader.js';

// Reusable temp objects — avoid per-sample allocations.
const _pos = new THREE.Vector3();
const _nrm = new THREE.Vector3();
const _col = new THREE.Color();
const _uv = new THREE.Vector2();
const _worldPos = new THREE.Vector3();
const _worldNrm = new THREE.Vector3();

export class LightPointSystem {
  constructor(scene) {
    this.scene = scene;
    this.cfg = CONFIG.lightPoints;

    this.points = null;          // THREE.Points
    this.geometry = null;        // BufferGeometry
    this.material = null;        // ShaderMaterial
    this._samplers = [];         // TextureColorSampler[] for disposal
    this._distance = Infinity;   // player↔window center distance (for M5 / debug)
    this._time = 0;
  }

  // ------------------------------------------------------------------
  // Generation — sample the model and build the point cloud.
  // Call AFTER the model has been placed (RoseWindowModel) so world matrices are set.
  // ------------------------------------------------------------------
  generate(resources) {
    const gltf = resources.getModel('roseWindow');
    if (!gltf || !gltf.scene) {
      console.warn('[LightPointSystem] Rose window model not loaded — cannot generate points.');
      return false;
    }

    const model = gltf.scene;
    // Ensure world matrices are current (RoseWindowModel applied transforms directly).
    model.updateMatrixWorld(true);

    const cfg = this.cfg;

    // Collect meshes by configured name. Fall back to all meshes if names don't match.
    const meshes = this._collectMeshes(model);

    // Total = sum of per-mesh counts (independent — glass and frame controlled separately).
    const total = meshes.reduce((sum, m) => sum + m.count, 0);
    if (total <= 0) {
      console.warn('[LightPointSystem] No points to generate (total count is 0).');
      return false;
    }

    // Allocate output arrays (Float32).
    const positions = new Float32Array(total * 3);
    const colors = new Float32Array(total * 3);
    const normals = new Float32Array(total * 3);
    const sizes = new Float32Array(total);
    const seeds = new Float32Array(total);

    // Sample each mesh by its absolute count.
    let offset = 0;
    for (const entry of meshes) {
      if (entry.count <= 0) continue;
      this._sampleMesh(entry.mesh, entry.count, positions, colors, normals, sizes, seeds, offset);
      offset += entry.count;
    }

    // Build the geometry.
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('aNormal', new THREE.BufferAttribute(normals, 3));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
    // Bounding sphere so frustum culling doesn't cull the whole cloud by mistake.
    geometry.boundingSphere = new THREE.Sphere(
      new THREE.Vector3(
        CONFIG.scene.roseWindowCenter.x,
        CONFIG.scene.roseWindowCenter.y,
        CONFIG.scene.roseWindowCenter.z
      ),
      CONFIG.roseWindow.targetSize * 1.5
    );

    this.geometry = geometry;

    // Build the material.
    this.material = this._createMaterial();

    // Build the Points object.
    this.points = new THREE.Points(geometry, this.material);
    this.points.name = 'LightPointSystem';
    this.points.frustumCulled = false; // we set boundingSphere manually; keep it simple
    this.scene.add(this.points);

    console.log(
      `[LightPointSystem] Generated ${total} points across ${meshes.length} mesh(es). ` +
      `Breakdown: ${meshes.map((m) => `${m.mesh.name}=${m.count}`).join(', ')}`
    );
    return true;
  }

  // ------------------------------------------------------------------
  // Collect the meshes to sample, matching CONFIG.lightPoints.meshSampling names.
  // ------------------------------------------------------------------
  _collectMeshes(model) {
    const cfgEntries = this.cfg.meshSampling;
    const found = [];

    for (const entry of cfgEntries) {
      const mesh = model.getObjectByName(entry.name);
      if (mesh && mesh.isMesh) {
        found.push({ mesh, count: entry.count });
      } else {
        console.warn(`[LightPointSystem] Mesh "${entry.name}" not found in model.`);
      }
    }

    // Fallback: if no configured mesh matched, sample every mesh with a default count.
    if (found.length === 0) {
      console.warn('[LightPointSystem] No configured meshes matched — sampling all meshes.');
      const all = [];
      model.traverse((obj) => { if (obj.isMesh) all.push(obj); });
      for (const m of all) found.push({ mesh: m, count: 50000 });
    }

    return found;
  }

  // ------------------------------------------------------------------
  // Sample `count` points from one mesh into the shared arrays at `offset`.
  // ------------------------------------------------------------------
  _sampleMesh(mesh, count, positions, colors, normals, sizes, seeds, offset) {
    // Build a surface sampler for this mesh (operates in LOCAL space).
    const sampler = new MeshSurfaceSampler(mesh).build();

    // Build a color lookup from the mesh's base color texture (if any).
    const tex = this._getBaseColorTexture(mesh);
    const colorSampler = tex ? TextureColorSampler.fromTexture(tex) : null;
    if (colorSampler) this._samplers.push(colorSampler);
    if (!colorSampler) {
      console.warn(`[LightPointSystem] Mesh "${mesh.name}" has no readable texture — using material.color fallback.`);
    }

    // Fallback color if no texture sampler.
    const fallbackColor = new THREE.Color();
    if (mesh.material && mesh.material.color) {
      fallbackColor.copy(mesh.material.color);
      fallbackColor.convertSRGBToLinear();
    } else {
      fallbackColor.setRGB(0.5, 0.5, 0.5);
    }

    // World transform matrices.
    const matrixWorld = mesh.matrixWorld;
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(matrixWorld);

    for (let i = 0; i < count; i++) {
      const idx = offset + i;

      // Sample local position + normal + UV (color output is ignored — sampler can't read textures).
      sampler.sample(_pos, _nrm, _col, _uv);

      // Transform position → world space.
      _worldPos.copy(_pos).applyMatrix4(matrixWorld);
      positions[idx * 3] = _worldPos.x;
      positions[idx * 3 + 1] = _worldPos.y;
      positions[idx * 3 + 2] = _worldPos.z;

      // Transform normal → world space (normalize after transform).
      _worldNrm.copy(_nrm).applyMatrix3(normalMatrix).normalize();
      normals[idx * 3] = _worldNrm.x;
      normals[idx * 3 + 1] = _worldNrm.y;
      normals[idx * 3 + 2] = _worldNrm.z;

      // Look up color from texture by UV, or fall back.
      if (colorSampler) {
        colorSampler.sample(_uv, _col);
      } else {
        _col.copy(fallbackColor);
      }
      colors[idx * 3] = _col.r;
      colors[idx * 3 + 1] = _col.g;
      colors[idx * 3 + 2] = _col.b;

      // Per-point size variation + random seed for idle phase.
      const v = this.cfg.point.sizeVariation;
      sizes[idx] = 1.0 + (Math.random() * 2 - 1) * v;
      seeds[idx] = Math.random();
    }
  }

  // ------------------------------------------------------------------
  // Find the base color (albedo) texture on a mesh's material.
  // Handles MeshStandardMaterial.map and array materials.
  // ------------------------------------------------------------------
  _getBaseColorTexture(mesh) {
    const mat = mesh.material;
    if (!mat) return null;
    if (Array.isArray(mat)) {
      for (const m of mat) {
        if (m && m.map) return m.map;
      }
      return null;
    }
    return mat.map || null;
  }

  // ------------------------------------------------------------------
  // Create the ShaderMaterial with all uniforms wired to CONFIG.
  // ------------------------------------------------------------------
  _createMaterial() {
    const c = this.cfg;
    const center = CONFIG.scene.roseWindowCenter;

    const uniforms = {
      uPlayerPos:          { value: new THREE.Vector3() },
      uWindowCenter:       { value: new THREE.Vector3(center.x, center.y, center.z) },
      uInteractionRadius:  { value: c.interaction.interactionRadius },
      uExplorationRadius:  { value: c.interaction.explorationRadius },
      uMaxDisplacement:    { value: c.interaction.maxDisplacement },
      uSpatialFalloff:     { value: c.interaction.spatialFalloff },
      uPlayerAvoidWeight:  { value: c.interaction.playerAvoidWeight },
      uIdleAmplitude:      { value: c.idle.amplitude },
      uIdleFrequency:      { value: c.idle.frequency },
      uTime:               { value: 0 },
      uPointSize:          { value: c.point.size },
      uPixelRatio:         { value: Math.min(window.devicePixelRatio, 2) },
      uOpacity:            { value: c.point.opacity },
      uCoreBoost:          { value: c.point.coreBoost },
      uGlobalOpacity:      { value: 1.0 },   // M8: dissipation fade
    };

    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: POINT_VERTEX_SHADER,
      fragmentShader: POINT_FRAGMENT_SHADER,
      transparent: true,
      depthWrite: c.depthWrite,
      blending: THREE.AdditiveBlending,
    });

    return material;
  }

  // ------------------------------------------------------------------
  // Per-frame update — push uniforms. All displacement math is in the shader.
  // ------------------------------------------------------------------
  update(dt, playerPosition) {
    if (!this.points) return;

    this._time += dt;
    const u = this.material.uniforms;
    u.uTime.value = this._time;
    u.uPlayerPos.value.copy(playerPosition);

    // Track distance for M5 (information nodes) + debug.
    const center = CONFIG.scene.roseWindowCenter;
    const dx = playerPosition.x - center.x;
    const dz = playerPosition.z - center.z;
    this._distance = Math.sqrt(dx * dx + dz * dz);

    // M8: dissipation — fade particles out as the player moves beyond interaction range.
    const dcfg = this.cfg.dissipation;
    if (dcfg && dcfg.enabled) {
      let factor = 1.0;
      if (this._distance > dcfg.startDistance) {
        // smoothstep: 1.0 at startDistance → 0.0 at endDistance
        const t = Math.min((this._distance - dcfg.startDistance) / (dcfg.endDistance - dcfg.startDistance), 1.0);
        const s = t * t * (3 - 2 * t);
        factor = 1.0 - s;
      }
      this._dissipationFactor = factor;
      u.uGlobalOpacity.value = factor;
      // Skip rendering entirely when fully dissipated (saves 200K-point draw call).
      this.points.visible = factor > 0.005;
    } else {
      this._dissipationFactor = 1.0;
    }
  }

  // ------------------------------------------------------------------
  // Accessors
  // ------------------------------------------------------------------
  getDistance() {
    return this._distance;
  }

  // M8: 1.0 = particles fully visible (close), 0.0 = fully dissipated (far).
  getDissipationFactor() {
    return this._dissipationFactor ?? 1.0;
  }

  // Quick state readout for debugging / future M5 logic.
  getState() {
    const d = this._distance;
    const c = this.cfg.interaction;
    if (d > c.interactionRadius) return 'observation';  // S0
    if (d > c.explorationRadius) return 'approach';     // S1
    return 'exploration';                               // S2
  }

  // ------------------------------------------------------------------
  // Cleanup
  // ------------------------------------------------------------------
  dispose() {
    if (this.points) {
      this.scene.remove(this.points);
      this.points = null;
    }
    if (this.geometry) {
      this.geometry.dispose();
      this.geometry = null;
    }
    if (this.material) {
      this.material.dispose();
      this.material = null;
    }
    // TextureColorSamplers hold no GPU resources (just JS arrays), but clear refs.
    this._samplers.length = 0;
  }
}
