// Lighting — the M2 lighting rig (Tech Spec Task 2.2).
//
// Three lights compose the rig, layered for a calm, stable gallery tone:
//
//   1. AmbientLight   — flat fill, prevents pure-black shadows.
//   2. HemisphereLight — subtle sky/ground gradient for natural ambient feel.
//   3. DirectionalLight — main key light from upper-front, simulates a gallery spot.
//
// Plus an optional HDR environment applied to scene.environment for PBR reflections.
// All intensities are tunable via CONFIG.lighting and must remain stable (no flicker,
// no sudden brightness changes — Interaction Spec §9, §10).
//
// The rig is returned as a THREE.Group so the caller can add/remove it as a unit.

import * as THREE from 'three';
import { CONFIG } from '../config/Config.js';

export function createLighting() {
  const group = new THREE.Group();
  group.name = 'Lighting';

  const cfg = CONFIG.lighting;

  // 1. Ambient — flat base fill.
  if (cfg.ambient.enabled) {
    const ambient = new THREE.AmbientLight(
      cfg.ambient.color,
      cfg.ambient.intensity
    );
    ambient.name = 'AmbientLight';
    group.add(ambient);
  }

  // 2. Hemisphere — soft sky/ground gradient.
  if (cfg.hemisphere.enabled) {
    const hemi = new THREE.HemisphereLight(
      cfg.hemisphere.skyColor,
      cfg.hemisphere.groundColor,
      cfg.hemisphere.intensity
    );
    hemi.name = 'HemisphereLight';
    group.add(hemi);
  }

  // 3. Directional — main key light.
  if (cfg.directional.enabled) {
    const dir = new THREE.DirectionalLight(
      cfg.directional.color,
      cfg.directional.intensity
    );
    const p = cfg.directional.position;
    dir.position.set(p.x, p.y, p.z);
    dir.castShadow = cfg.directional.castShadow;
    dir.name = 'DirectionalLight';
    group.add(dir);

    // A visible-but-tiny target at the rose window center so the light aims at the artwork.
    // DirectionalLight points from its position toward its .target (default origin).
    const target = new THREE.Object3D();
    const c = CONFIG.scene.roseWindowCenter;
    target.position.set(c.x, c.y, c.z);
    group.add(target);
    dir.target = target;
  }

  return group;
}

/**
 * Apply a PMREM-processed HDR environment to a scene.
 * Sets scene.environment (for PBR reflections) and optionally scene.background.
 *
 * @param {THREE.Scene} scene
 * @param {THREE.Texture|null} envMap  PMREM-processed environment texture
 */
export function applyHDREnvironment(scene, envMap) {
  if (!envMap) return;
  scene.environment = envMap;
  // Per CONFIG.lighting.hdr.background — by default we keep the dark clear color
  // and do NOT show the HDR as a visible background (gallery stays dark).
  if (CONFIG.lighting.hdr.background) {
    scene.background = envMap;
  }
}
