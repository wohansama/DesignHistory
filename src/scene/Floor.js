// Floor — the white exhibition floor (Global Requirement: white floor only, no ceiling/walls).
//
// Per the project global requirement, the M2 scene consists of exactly two visible
// elements: a white floor and the rose window. This module builds the floor.
//
// Design choices:
//   - PlaneGeometry rotated to lie on the y=0 plane (XZ plane).
//   - MeshStandardMaterial so it reacts to lighting (ambient + directional + HDR).
//   - Pure white color with high roughness → matte, calm, gallery-like.
//   - Large enough (default 60m) to give the player room to move (M3).

import * as THREE from 'three';
import { CONFIG } from '../config/Config.js';

export function createFloor() {
  const cfg = CONFIG.floor;
  const size = cfg.size;
  const geometry = new THREE.PlaneGeometry(size, size, cfg.segments, cfg.segments);
  // PlaneGeometry is built in the XY plane; rotate -90° around X to lay it flat (XZ plane).
  geometry.rotateX(-Math.PI / 2);

  const material = new THREE.MeshStandardMaterial({
    color: cfg.color,
    roughness: cfg.roughness,
    metalness: cfg.metalness,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(0, 0, 0);          // Sit on the ground plane
  mesh.name = 'Floor';

  // Hint for future shadow work (M7): floor should receive shadows when enabled.
  mesh.receiveShadow = cfg.receiveShadow;

  return mesh;
}
