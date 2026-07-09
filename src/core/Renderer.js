import * as THREE from 'three';
import { CONFIG } from '../config/Config.js';

export function createRenderer(container) {
  const cfg = CONFIG.renderer;
  const renderer = new THREE.WebGLRenderer({
    antialias: cfg.antialias,
  });
  renderer.setPixelRatio(cfg.pixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(cfg.clearColor, cfg.clearAlpha);

  // M2: tone mapping + color space for a stable HDR-lit pipeline.
  // ACESFilmic gives gentle, film-like highlights that suit a gallery tone.
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = cfg.toneMappingExposure;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  container.appendChild(renderer.domElement);
  return renderer;
}
