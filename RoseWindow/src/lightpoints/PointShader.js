// PointShader — GLSL for the Interactive Light Point System.
//
// All per-point behavior lives in the VERTEX shader so 250K points update at ~0 CPU cost:
//   - Task 4.3 idle breathing (sin + noise-driven animation)
//   - Task 4.4 distance detection (player↔window center)
//   - Task 4.5 displacement (normal main + small away-from-player, gaussian spatial weight)
//   - Task 4.6 recovery (intensity → 0 as player leaves → displacement naturally → 0)
//   - IMPROVEMENT_PLAN §1.1: hash-based 3D noise for non-synchronized breathing
//   - IMPROVEMENT_PLAN §1.4: displacement noise modulation (±15% variation)
//
// The fragment shader renders a dual-layer luminous point (core + halo) with saturation boost:
//   - IMPROVEMENT_PLAN §1.2: narrow core + wide halo for realistic light-particle look
//   - IMPROVEMENT_PLAN §1.3: subtle saturation boost for stained-glass colors

import { CONFIG } from '../config/Config.js';

const cfg = CONFIG.shader;

// ==================================================================
// Vertex shader
// ==================================================================
export const POINT_VERTEX_SHADER = /* glsl */ `
  uniform vec3  uPlayerPos;
  uniform vec3  uWindowCenter;
  uniform float uInteractionRadius;   // 8m — S1 starts
  uniform float uExplorationRadius;   // 3m — S2 starts
  uniform float uMaxDisplacement;     // ~0.28m (14% of 2m radius)
  uniform float uSpatialFalloff;      // Gaussian σ (m)
  uniform float uPlayerAvoidWeight;   // small away-from-player component
  uniform float uIdleAmplitude;
  uniform float uIdleFrequency;
  uniform float uTime;
  uniform float uPointSize;           // base world size
  uniform float uPixelRatio;

  attribute vec3  aColor;     // linear-space color sampled from texture
  attribute vec3  aNormal;    // world-space surface normal
  attribute float aSize;      // per-point size multiplier
  attribute float aSeed;      // 0..1 random, for idle phase

  varying vec3  vColor;
  varying float vAlphaBoost;  // extra brightness for points being displaced

  // ---- IMPROVEMENT_PLAN §1.1: hash-based 3D value noise ----
  // GPU-friendly, no texture lookup, each point moves independently.
  float hash(vec3 p) {
    p = fract(p * vec3(443.8975, 397.2973, 491.1871));
    p += dot(p, p.yxz + 19.19);
    return fract((p.x + p.y) * p.z);
  }

  float noise3(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);  // smoothstep interpolation

    // 8-corner trilinear interpolation
    float n000 = hash(i);
    float n100 = hash(i + vec3(1.0, 0.0, 0.0));
    float n010 = hash(i + vec3(0.0, 1.0, 0.0));
    float n110 = hash(i + vec3(1.0, 1.0, 0.0));
    float n001 = hash(i + vec3(0.0, 0.0, 1.0));
    float n101 = hash(i + vec3(1.0, 0.0, 1.0));
    float n011 = hash(i + vec3(0.0, 1.0, 1.0));
    float n111 = hash(i + vec3(1.0, 1.0, 1.0));

    return mix(
      mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y),
      mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y),
      f.z
    );
  }

  void main() {
    vColor = aColor;

    // ---- Task 4.4: distance → interaction intensity ----
    // Use horizontal (XZ) distance: the window is vertical, the player walks on the floor.
    float d = distance(uPlayerPos.xz, uWindowCenter.xz);
    // smoothstep(edge0=8, edge1=3): 1.0 at ≤3m, 0.0 at ≥8m, smooth in between.
    float intensity = smoothstep(uInteractionRadius, uExplorationRadius, d);

    // ---- Spatial weight: only points near the player's approach respond strongly ----
    vec2 toPlayerXZ = uPlayerPos.xz - position.xz;
    float inPlaneDist = length(toPlayerXZ);
    float spatialW = exp(-inPlaneDist * inPlaneDist / (2.0 * uSpatialFalloff * uSpatialFalloff));

    float mag = intensity * spatialW * uMaxDisplacement;

    // ---- IMPROVEMENT_PLAN §1.4: displacement noise modulation ----
    float noiseDisp = noise3(position * 0.3 + uTime * 0.08) * ${cfg.displacementNoise.toFixed(2)};
    mag *= (1.0 + noiseDisp);

    // ---- Task 4.5: displacement direction = normal (main) + away-from-player (small) ----
    vec3 awayFromPlayer = position - uPlayerPos;
    float awayLen = length(awayFromPlayer);
    vec3 awayDir = awayLen > 0.0001 ? awayFromPlayer / awayLen : aNormal;
    vec3 dir = normalize(aNormal) + uPlayerAvoidWeight * awayDir;
    dir = normalize(dir + vec3(0.00001));

    // ---- Task 4.3 + IMPROVEMENT_PLAN §1.1: noise-driven idle breathing ----
    float phase = aSeed * 6.2831853;
    float sinWave = sin(uTime * uIdleFrequency * 6.2831853 + phase);
    // Space-correlated, time-evolving 3D noise — each point moves independently
    float noiseT = noise3(position * 0.5 + uTime * 0.15);
    // Blend sin and noise so the motion has both rhythm and organic drift
    float idle = (sinWave * (1.0 - ${cfg.noiseIdleWeight.toFixed(2)}) + noiseT * ${cfg.noiseIdleWeight.toFixed(2)}) * uIdleAmplitude;
    vec3 idleOffset = aNormal * idle;

    vec3 displaced = position + dir * mag + idleOffset;

    // Brighten points that are actively being displaced — adds life to the response.
    vAlphaBoost = 0.5 + 0.5 * mag / uMaxDisplacement;

    vec4 mvPosition = modelViewMatrix * vec4(displaced, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    // Perspective-correct point size: closer = bigger.
    gl_PointSize = uPointSize * uPixelRatio * aSize * (300.0 / max(-mvPosition.z, 0.01));
  }
`;

// ==================================================================
// Fragment shader — dual-layer core+halo with saturation boost
// ==================================================================
export const POINT_FRAGMENT_SHADER = /* glsl */ `
  precision mediump float;

  uniform float uOpacity;
  uniform float uCoreBoost;   // UNUSED by the new dual-layer model (kept for compatibility)
  uniform float uGlobalOpacity; // M8: global fade for dissipation

  varying vec3  vColor;
  varying float vAlphaBoost;

  void main() {
    // gl_PointCoord is [0,1]² within the point sprite. Center = 0.5.
    vec2 pc = gl_PointCoord - vec2(0.5);
    float dist = length(pc);

    // Circular clip.
    if (dist > 0.5) discard;

    // ---- IMPROVEMENT_PLAN §1.2: core + halo dual-layer ----
    // Narrow bright core — concentrated, high luminance
    float core = exp(-dist * dist * ${cfg.coreSharpness.toFixed(1)});
    // Wide soft halo — diffuse, lower luminance, blends with neighbors
    float halo = exp(-dist * dist * ${cfg.haloSharpness.toFixed(1)});

    // Additive-friendly brightness: overlapping cores → bright clusters
    float brightness = core * 1.5 + halo * 0.4;
    // Alpha from both layers so the point stays visible in its full extent
    float alpha = max(core, halo * 0.6) * uOpacity * uGlobalOpacity;

    // ---- IMPROVEMENT_PLAN §1.3: color saturation micro-boost ----
    float gray = dot(vColor, vec3(0.299, 0.587, 0.114));
    vec3 saturated = mix(vec3(gray), vColor, ${cfg.saturation.toFixed(2)});

    vec3 color = saturated * brightness * (0.85 + 0.15 * vAlphaBoost);

    gl_FragColor = vec4(color, alpha);
  }
`;
