// PostProcessing — selective Bloom with additive compositing ON TOP.
//
// Problem solved: in the previous "bloom-under, scene-on-top" pipeline, the
// opaque floor overwrote the bloom glow on screen. Now bloom is composited
// ADDITIVELY on top of the full scene, so glow appears over the floor.
//
// Render sequence each frame:
//   1. renderer.render(full scene) → screen (base, tone mapped). Floor + nodes
//      + particles all visible, correct depth.
//   2. Darken non-bloom meshes (floor → black). Nodes (userData.bloom) + Points
//      keep their materials.
//   3. bloomComposer.render(): RenderPass (bloom objects only) → UnrealBloomPass
//      → additive ShaderPass (composites bloom ON TOP of the base screen with
//      AdditiveBlending, autoClear=false so the base isn't overwritten).
//   4. Restore materials.
//
// The additive pass adds the bloom buffer (bloom objects + glow, on black) to
// the screen. Black adds nothing; bright areas add glow. The floor is in the
// base only — no double-brightening. Nodes/particles get a brightness boost
// (additive) which reads as "glow."

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { CONFIG } from '../config/Config.js';

// Shared black material — reused across all darkened meshes.
const _darkMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });

// Additive composite shader — passes through the texture, blended additively
// onto the screen so the bloom glow appears on top of the base scene.
const AdditiveCompositeShader = {
  uniforms: { tDiffuse: { value: null } },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    varying vec2 vUv;
    void main() {
      gl_FragColor = texture2D(tDiffuse, vUv);
    }
  `,
};

export function createPostProcessing({ renderer, scene, camera }) {
  const cfg = CONFIG.postProcessing;
  if (!cfg || !cfg.enabled) return null;

  // --- Bloom composer: renders bloom objects → blooms → additive composite to screen ---
  const bloomComposer = new EffectComposer(renderer);
  bloomComposer.addPass(new RenderPass(scene, camera));

  let bloomPass = null;
  if (cfg.bloom && cfg.bloom.enabled) {
    bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      cfg.bloom.strength,
      cfg.bloom.radius,
      cfg.bloom.threshold
    );
    bloomComposer.addPass(bloomPass);
  }

  // Final pass: additive composite onto the screen (no OutputPass — bloom stays
  // in linear space; added additively to the tone-mapped base for a pure glow).
  const additivePass = new ShaderPass(AdditiveCompositeShader);
  additivePass.material.blending = THREE.AdditiveBlending;
  additivePass.material.transparent = true;
  additivePass.material.depthWrite = false;
  additivePass.material.depthTest = false;
  bloomComposer.addPass(additivePass);

  // --- Material swap state ---
  const _materials = new Map();

  function darkenNonBloomed() {
    scene.traverse((obj) => {
      if (obj.isMesh && !obj.userData.bloom) {
        _materials.set(obj.uuid, obj.material);
        obj.material = _darkMaterial;
      }
    });
  }

  function restoreMaterial() {
    scene.traverse((obj) => {
      if (obj.isMesh && _materials.has(obj.uuid)) {
        obj.material = _materials.get(obj.uuid);
        _materials.delete(obj.uuid);
      }
    });
  }

  // --- Per-frame render ---
  function render() {
    // 1. Render the full scene → screen (base, tone mapped by renderer).
    //    Floor + nodes + particles all visible with correct depth.
    renderer.render(scene, camera);

    // 2. Add bloom ON TOP (additive). autoClear=false so the base isn't destroyed.
    renderer.autoClear = false;
    darkenNonBloomed();
    bloomComposer.render();
    restoreMaterial();
    renderer.autoClear = true;
  }

  return {
    composer: bloomComposer,
    bloomPass,
    render,
    setSize(w, h) { bloomComposer.setSize(w, h); },
    dispose() {
      bloomComposer.dispose();
      _darkMaterial.dispose();
    },
  };
}
