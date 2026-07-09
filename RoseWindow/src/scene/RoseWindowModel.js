// RoseWindowModel — loads the GLB rose window and places it at the exhibition center.
//
// Tech Spec §4.1: GLB is the preferred source; PNG orthographic is the fallback.
// In M2 we load the GLB (Task 2.1 / 2.2 deliverable: "One central rose window").
//
// Placement:
//   - The model's bounding box longest dimension is normalized to CONFIG.roseWindow.targetSize
//     so the window reads well from the 10m viewing distance regardless of authoring scale.
//   - The model is re-centered so its bounding-box center sits at CONFIG.scene.roseWindowCenter
//     (default (0, 2, 0)).
//   - A CONFIG.roseWindow.rotationY is applied so the window faces the player at z=+10.
//
// The function expects a ResourceManager that has already loaded the model under the
// given name. We do the normalization here (post-load) rather than at load time so
// the raw asset stays available for M4's Light Point System to sample geometry/colors.

import * as THREE from 'three';
import { CONFIG } from '../config/Config.js';

/**
 * Build the rose window Object3D from a loaded GLB.
 * @param {ResourceManager} resources  Must contain the model under `name`.
 * @param {string} name  Model key in ResourceManager.assets.models (default 'roseWindow').
 * @returns {THREE.Object3D|null}  The placed rose window object, or null on failure.
 */
export function createRoseWindowModel(resources, name = 'roseWindow') {
  const gltf = resources.getModel(name);
  if (!gltf || !gltf.scene) {
    console.warn('[RoseWindowModel] Model not found in ResourceManager. Rose window will be absent.');
    return null;
  }

  const cfg = CONFIG.roseWindow;
  const model = gltf.scene;

  // 1. Normalize scale so the longest bounding-box dimension equals targetSize.
  //    We compute the box in the model's local space first.
  const box = new THREE.Box3().setFromObject(model);
  const size = new THREE.Vector3();
  box.getSize(size);
  const longest = Math.max(size.x, size.y, size.z);
  // Guard against zero-size models.
  const scale = longest > 0 ? cfg.targetSize / longest : 1;
  model.scale.setScalar(scale);

  // 2. Recompute the box after scaling and re-center so the box center lands on
  //    roseWindowCenter + centerOffset.
  const scaledBox = new THREE.Box3().setFromObject(model);
  const scaledCenter = new THREE.Vector3();
  scaledBox.getCenter(scaledCenter);

  const target = new THREE.Vector3(
    CONFIG.scene.roseWindowCenter.x + cfg.centerOffset.x,
    CONFIG.scene.roseWindowCenter.y + cfg.centerOffset.y,
    CONFIG.scene.roseWindowCenter.z + cfg.centerOffset.z
  );

  // Move the model so its box center coincides with the target.
  model.position.x += target.x - scaledCenter.x;
  model.position.y += target.y - scaledCenter.y;
  model.position.z += target.z - scaledCenter.z;

  // 3. Apply rotation so the window faces the player (player is at z=+10, looking -Z).
  model.rotation.y = cfg.rotationY;

  // 4. Visibility / naming for easy lookup later.
  model.name = 'RoseWindowModel';
  model.visible = cfg.visible;

  // 5. Ensure materials play nice with the M2 lighting + HDR env.
  //    GLB materials are usually MeshStandardMaterial already; we just make sure
  //    envMapIntensity is reasonable and the model is lit (not unlitBasic).
  model.traverse((obj) => {
    if (obj.isMesh) {
      const mat = obj.material;
      if (mat && mat.isMeshStandardMaterial) {
        // PBR reflection strength from the HDR environment.
        if (mat.envMapIntensity === undefined || mat.envMapIntensity === 1) {
          mat.envMapIntensity = CONFIG.lighting.hdr.environmentIntensity;
        }
      }
      // Future-proof: enable shadow casting/receiving flags for M7.
      obj.castShadow = false;
      obj.receiveShadow = false;
    }
  });

  // Sanity log — useful for tuning CONFIG.roseWindow.targetSize / rotationY.
  const finalBox = new THREE.Box3().setFromObject(model);
  const finalSize = new THREE.Vector3();
  finalBox.getSize(finalSize);
  console.log(
    `[RoseWindowModel] Placed. scale=${scale.toFixed(3)} size=(${finalSize.x.toFixed(2)}, ${finalSize.y.toFixed(2)}, ${finalSize.z.toFixed(2)}) center=(${target.x}, ${target.y}, ${target.z})`
  );

  return model;
}
