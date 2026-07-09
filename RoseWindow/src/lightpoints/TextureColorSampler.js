// TextureColorSampler — CPU-side texture color lookup by UV.
//
// Why this exists:
//   MeshSurfaceSampler can sample UV coordinates on a mesh surface, but it CANNOT
//   read colors from a material's texture map (it only reads the geometry's `color`
//   vertex attribute, which our GLB doesn't have). So we sample the UV, then look
//   up the pixel color ourselves by drawing the texture to a canvas and reading
//   ImageData.
//
// Color space note:
//   The canvas yields raw sRGB bytes (0-255). three.js color management assumes
//   data in BufferGeometry attributes is in linear space. We convert sRGB→linear
//   here so the final rendered colors match the original artwork after the
//   renderer's linear→sRGB output conversion.

import * as THREE from 'three';

export class TextureColorSampler {
  /**
   * Build a sampler from a THREE.Texture (typically material.map).
   * Returns null if the texture has no usable image (e.g. not yet decoded).
   */
  static fromTexture(texture) {
    if (!texture || !texture.image) {
      console.warn('[TextureColorSampler] No texture/image available.');
      return null;
    }

    const image = texture.image;
    let width, height, data;

    try {
      // Draw the image to a canvas to access pixel data.
      // Works for HTMLImageElement, HTMLCanvasElement, ImageBitmap.
      const canvas = document.createElement('canvas');
      width = image.width || image.videoWidth || 1;
      height = image.height || image.videoHeight || 1;
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(image, 0, 0, width, height);
      const imageData = ctx.getImageData(0, 0, width, height);
      data = imageData.data; // Uint8ClampedArray [r,g,b,a, ...]
    } catch (err) {
      console.warn('[TextureColorSampler] Failed to read texture pixels:', err);
      return null;
    }

    // Cache the texture's wrapping mode so UV lookups respect it.
    const wrapS = texture.wrapS ?? THREE.RepeatWrapping;
    const wrapT = texture.wrapT ?? THREE.RepeatWrapping;

    return new TextureColorSampler(width, height, data, wrapS, wrapT, texture);
  }

  constructor(width, height, data, wrapS, wrapT, sourceTexture) {
    this.width = width;
    this.height = height;
    this.data = data;
    this.wrapS = wrapS;
    this.wrapT = wrapT;
    this.sourceTexture = sourceTexture;
  }

  /**
   * Sample the texture color at the given UV.
   * @param {THREE.Vector2} uv
   * @param {THREE.Color} target  written with LINEAR-space color
   */
  sample(uv, target) {
    const { width, height, data, wrapS, wrapT } = this;

    // Apply wrapping to UV. RepeatWrapping → fractional modulo; ClampToEdge → clamp.
    let u = uv.x;
    let v = uv.y;
    if (wrapS === THREE.RepeatWrapping) {
      u = u - Math.floor(u);
    } else {
      u = Math.min(Math.max(u, 0), 1);
    }
    if (wrapT === THREE.RepeatWrapping) {
      v = v - Math.floor(v);
    } else {
      v = Math.min(Math.max(v, 0), 1);
    }

    // Flip Y: texture origin is top-left in canvas, but UV origin is bottom-left in WebGL.
    let x = Math.floor(u * width);
    let y = Math.floor((1 - v) * height);
    // Clamp to valid range (guard against edge rounding).
    x = Math.min(Math.max(x, 0), width - 1);
    y = Math.min(Math.max(y, 0), height - 1);

    const idx = (y * width + x) * 4;
    const r = data[idx] / 255;
    const g = data[idx + 1] / 255;
    const b = data[idx + 2] / 255;

    // Store raw sRGB values, then convert to linear working space.
    target.setRGB(r, g, b);
    target.convertSRGBToLinear();
  }
}
