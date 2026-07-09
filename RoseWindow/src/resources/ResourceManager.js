// ResourceManager — central async asset loading hub (Tech Spec §10, §15).
//
// Responsibilities:
//   1. Load GLB models via GLTFLoader.
//   2. Load HDR environment maps via RGBELoader (.hdr) or EXRLoader (.exr) + PMREMGenerator.
//   3. Expose a single `loadAll()` Promise the Application awaits before starting.
//   4. Report progress through an optional onProgress callback (0..1).
//
// Design notes:
//   - Loaders are created lazily and reused.
//   - PMREMGenerator is expensive; created once and disposed after the env map is built.
//   - All public methods are async and reject on error so the caller can handle failures.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js';

export class ResourceManager {
  constructor(renderer) {
    this.renderer = renderer;

    // Lazily-initialized loaders
    this._gltfLoader = null;
    this._rgbeLoader = null;
    this._exrLoader = null;
    this._pmremGenerator = null;

    // Loaded assets are stored here for the rest of the app to read.
    this.assets = {
      models: new Map(),   // name -> { scene, animations, ... }
      hdrEnvironment: null, // THREE.Texture (PMREM-processed) or null
      hdrEquirectangular: null, // Original high-res equirectangular texture (for scene.background)
    };
  }

  // ------------------------------------------------------------------
  // Lazy loader accessors
  // ------------------------------------------------------------------
  _getGLTFLoader() {
    if (!this._gltfLoader) {
      this._gltfLoader = new GLTFLoader();
      // Set a reasonable DRACO path only if needed — the bundled rose-window.glb
      // is uncompressed, so we skip DRACOLoader for now to avoid extra deps.
    }
    return this._gltfLoader;
  }

  _getRGBELoader() {
    if (!this._rgbeLoader) {
      this._rgbeLoader = new RGBELoader();
    }
    return this._rgbeLoader;
  }

  _getEXRLoader() {
    if (!this._exrLoader) {
      this._exrLoader = new EXRLoader();
    }
    return this._exrLoader;
  }

  _getPMREMGenerator() {
    if (!this._pmremGenerator) {
      this._pmremGenerator = new THREE.PMREMGenerator(this.renderer);
      this._pmremGenerator.compileEquirectangularShader();
    }
    return this._pmremGenerator;
  }

  // ------------------------------------------------------------------
  // Individual loaders — each returns a Promise.
  // ------------------------------------------------------------------

  /**
   * Load a GLB model and store it under `name`.
   * Returns the gltf result object { scene, animations, ... }.
   */
  loadModel(name, path) {
    const loader = this._getGLTFLoader();
    return new Promise((resolve, reject) => {
      loader.load(
        path,
        (gltf) => {
          this.assets.models.set(name, gltf);
          console.log(`[ResourceManager] Model "${name}" loaded from ${path}`);
          resolve(gltf);
        },
        (xhr) => {
          // Progress is reported by the browser; left to loadAll's aggregator.
        },
        (err) => {
          console.error(`[ResourceManager] Failed to load model "${name}" from ${path}:`, err);
          reject(err);
        }
      );
    });
  }

  /**
   * Load an HDR environment map, pre-filter it via PMREM, and store the result.
   * Returns the processed THREE.Texture suitable for scene.environment.
   * If the file fails to load, resolves null so the app can continue without HDR.
   */
  loadHDR(path) {
    // Select the appropriate loader based on file extension.
    // Both RGBELoader (.hdr) and EXRLoader (.exr) produce DataTexture
    // that PMREMGenerator can process identically.
    const isEXR = path.toLowerCase().endsWith('.exr');
    const loader = isEXR ? this._getEXRLoader() : this._getRGBELoader();
    const pmrem = this._getPMREMGenerator();
    return new Promise((resolve) => {
      loader.load(
        path,
        (texture) => {
          // Set equirectangular mapping so the texture can be used as scene.background.
          texture.mapping = THREE.EquirectangularReflectionMapping;
          // Convert equirectangular HDR into a cubemap-style pre-filtered env map.
          const envMap = pmrem.fromEquirectangular(texture).texture;
          // Keep the original high-res texture for scene.background (PMREM is low-res/blurry).
          this.assets.hdrEnvironment = envMap;
          this.assets.hdrEquirectangular = texture;
          console.log(`[ResourceManager] HDR environment loaded from ${path}`);
          resolve(envMap);
        },
        undefined,
        (err) => {
          // HDR is optional (Tech Spec §2.2). Do not fail the whole boot.
          console.warn(`[ResourceManager] HDR load failed (optional, continuing without): ${path}`, err);
          resolve(null);
        }
      );
    });
  }

  // ------------------------------------------------------------------
  // Aggregate loader — used by Application to load everything up front.
  // ------------------------------------------------------------------

  /**
   * Load all M2 assets.
   * @param {Object} manifest  { models: [{name, path}], hdr: { path } | null }
   * @param {Function} onProgress  optional (loaded, total, url) => void
   * @returns {Promise<void>}
   */
  async loadAll(manifest, onProgress) {
    const tasks = [];
    const total = (manifest.models?.length || 0) + (manifest.hdr ? 1 : 0);
    let done = 0;
    const tick = (url) => {
      done += 1;
      if (onProgress) onProgress(done, total, url);
    };

    if (manifest.models) {
      for (const m of manifest.models) {
        // Chain a progress tick after each model resolves.
        tasks.push(
          this.loadModel(m.name, m.path).then((res) => { tick(m.path); return res; })
        );
      }
    }
    if (manifest.hdr) {
      tasks.push(
        this.loadHDR(manifest.hdr.path).then((res) => { tick(manifest.hdr.path); return res; })
      );
    }

    await Promise.all(tasks);
  }

  // ------------------------------------------------------------------
  // Accessors
  // ------------------------------------------------------------------
  getModel(name) {
    return this.assets.models.get(name);
  }

  getHDREnvironment() {
    return this.assets.hdrEnvironment;
  }

  getHDREquirectangular() {
    return this.assets.hdrEquirectangular;
  }

  // ------------------------------------------------------------------
  // Cleanup
  // ------------------------------------------------------------------
  dispose() {
    // Dispose loaded model geometries/materials/textures.
    for (const gltf of this.assets.models.values()) {
      gltf.scene?.traverse((obj) => {
        if (obj.isMesh) {
          obj.geometry?.dispose();
          const mat = obj.material;
          if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
          else mat?.dispose();
        }
      });
    }
    this.assets.models.clear();

    // Dispose HDR env map + original equirectangular texture.
    if (this.assets.hdrEnvironment) {
      this.assets.hdrEnvironment.dispose();
      this.assets.hdrEnvironment = null;
    }
    if (this.assets.hdrEquirectangular) {
      this.assets.hdrEquirectangular.dispose();
      this.assets.hdrEquirectangular = null;
    }

    // Dispose PMREM generator (it holds GPU resources).
    if (this._pmremGenerator) {
      this._pmremGenerator.dispose();
      this._pmremGenerator = null;
    }
  }
}
