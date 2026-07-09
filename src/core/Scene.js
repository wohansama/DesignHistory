// Scene — the THREE.Scene container.
//
// In M2 the scene holds: white floor + rose window + lighting rig.
// (Per the project global requirement, there is no ceiling and no surrounding walls.)
//
// M1's verification markers (test cube + axes helper) are gated behind
// CONFIG.verification flags and disabled by default — they can be turned
// back on for debugging spatial reference.

import * as THREE from 'three';
import { CONFIG } from '../config/Config.js';

export function createScene() {
  const scene = new THREE.Scene();
  scene.name = 'RoseWindowScene';

  // Optional M1 verification markers (off by default in M2).
  const v = CONFIG.verification;
  const c = CONFIG.scene.roseWindowCenter;

  if (v.showTestCube) {
    const geo = new THREE.BoxGeometry(v.cubeSize, v.cubeSize, v.cubeSize);
    const mat = new THREE.MeshBasicMaterial({ color: v.cubeColor });
    const cube = new THREE.Mesh(geo, mat);
    cube.position.set(c.x, c.y, c.z);
    cube.name = '__M1_TEST_CUBE__';
    scene.add(cube);
  }

  if (v.showAxesHelper) {
    const axes = new THREE.AxesHelper(v.axesSize);
    axes.position.set(c.x, c.y, c.z);
    axes.name = '__M1_AXES__';
    scene.add(axes);
  }

  // Fog is configurable but disabled by default (minimal scene).
  if (CONFIG.scene.fog) {
    const f = CONFIG.scene.fog;
    scene.fog = new THREE.Fog(f.color, f.near, f.far);
  }

  return scene;
}
