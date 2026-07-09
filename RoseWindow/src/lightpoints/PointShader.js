// PointShader — GLSL for the Interactive Light Point System.
//
// All per-point behavior lives in the VERTEX shader so 50K points update at ~0 CPU cost:
//   - Task 4.3 idle breathing (sin wave along normal)
//   - Task 4.4 distance detection (player↔window center)
//   - Task 4.5 displacement (normal main + small away-from-player, gaussian spatial weight)
//   - Task 4.6 recovery (intensity → 0 as player leaves → displacement naturally → 0)
//
// The fragment shader renders a soft circular luminous point suited to additive blending.

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

  void main() {
    vColor = aColor;

    // ---- Task 4.4: distance → interaction intensity ----
    // Use horizontal (XZ) distance: the window is vertical, the player walks on the floor.
    float d = distance(uPlayerPos.xz, uWindowCenter.xz);
    // smoothstep(edge0=8, edge1=3): 1.0 at ≤3m, 0.0 at ≥8m, smooth in between.
    // smoothstep returns 0 when d≥8 and 1 when d≤3.
    float intensity = smoothstep(uInteractionRadius, uExplorationRadius, d);

    // ---- Spatial weight: only points near the player's approach respond strongly ----
    // Distance from this point to the player (horizontal), so the response localizes
    // around where the visitor stands rather than the whole window pulsing uniformly.
    vec2 toPlayerXZ = uPlayerPos.xz - position.xz;
    float inPlaneDist = length(toPlayerXZ);
    float spatialW = exp(-inPlaneDist * inPlaneDist / (2.0 * uSpatialFalloff * uSpatialFalloff));

    float mag = intensity * spatialW * uMaxDisplacement;

    // ---- Task 4.5: displacement direction = normal (main) + away-from-player (small) ----
    vec3 awayFromPlayer = position - uPlayerPos;
    // Guard against zero-length when the player stands exactly on a point.
    float awayLen = length(awayFromPlayer);
    vec3 awayDir = awayLen > 0.0001 ? awayFromPlayer / awayLen : aNormal;
    vec3 dir = normalize(aNormal) + uPlayerAvoidWeight * awayDir;
    // Re-normalize so the magnitude stays controlled.
    dir = normalize(dir + vec3(0.00001));

    // ---- Task 4.3: idle breathing along the normal ----
    float phase = aSeed * 6.2831853;
    float idle = sin(uTime * uIdleFrequency * 6.2831853 + phase) * uIdleAmplitude;
    vec3 idleOffset = aNormal * idle;

    vec3 displaced = position + dir * mag + idleOffset;

    // Brighten points that are actively being displaced — adds life to the response.
    vAlphaBoost = 0.5 + 0.5 * mag / uMaxDisplacement;

    vec4 mvPosition = modelViewMatrix * vec4(displaced, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    // Perspective-correct point size: closer = bigger. 300 is an empirical scale factor.
    gl_PointSize = uPointSize * uPixelRatio * aSize * (300.0 / max(-mvPosition.z, 0.01));
  }
`;

// ==================================================================
// Fragment shader — soft luminous point with brightness overflow for bloom
// ==================================================================
export const POINT_FRAGMENT_SHADER = /* glsl */ `
  precision mediump float;

  uniform float uOpacity;
  uniform float uCoreBoost;   // Center brightness overflow (default 2.0 → cores reach 3× base)
  uniform float uGlobalOpacity; // M8: global fade for dissipation (1.0=visible, 0.0=gone)

  varying vec3  vColor;
  varying float vAlphaBoost;

  void main() {
    // gl_PointCoord is [0,1]² within the point sprite. Center = 0.5.
    vec2 pc = gl_PointCoord - vec2(0.5);
    float dist = length(pc);

    // Circular clip.
    if (dist > 0.5) discard;

    // Gaussian soft falloff — a long luminous tail instead of a hard-edged disc.
    float glow = exp(-dist * dist * 14.0);

    // Center brightness overflow: core is 1.0 at center, 0.0 at the edge.
    // brightness reaches (1 + coreBoost)× base color, so additive overlapping
    // points accumulate toward white — exactly what the bloom pass captures.
    float core = max(1.0 - dist * 2.0, 0.0);
    float brightness = 1.0 + core * uCoreBoost;

    vec3 color = vColor * brightness * (0.85 + 0.15 * vAlphaBoost);

    gl_FragColor = vec4(color, glow * uOpacity * uGlobalOpacity);
  }
`;
