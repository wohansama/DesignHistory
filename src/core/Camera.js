import * as THREE from 'three';
import { CONFIG } from '../config/Config.js';

export function createCamera() {
  const { fov, near, far, initialPosition, lookAt } = CONFIG.camera;
  const camera = new THREE.PerspectiveCamera(
    fov,
    window.innerWidth / window.innerHeight,
    near,
    far
  );
  camera.position.set(initialPosition.x, initialPosition.y, initialPosition.z);
  camera.lookAt(lookAt.x, lookAt.y, lookAt.z);
  return camera;
}
