// Centralized configuration object for the Rose Window Digital Exhibition System.
// All tunable parameters live here (per Technical Specification §14).
//
// Global Requirement override (项目全局要求.txt):
//   The current version scene only needs to include the rose window and a white floor.
//   Ceiling and four walls are NOT built in M2 (overridden despite Task List §4 Task 2.1).
//   Do not implement features from future milestones in advance.

export const CONFIG = {
  // ------------------------------------------------------------------
  // Renderer
  // ------------------------------------------------------------------
  renderer: {
    antialias: true,
    clearColor: 0x1a1a2e,        // Dark exhibition hall tone
    clearAlpha: 1.0,
    pixelRatio: Math.min(window.devicePixelRatio, 2), // Cap at 2 to prevent overload
    toneMapping: 'ACESFilmic',   // M2: tone mapping for HDR pipeline
    toneMappingExposure: 1.0,
    outputColorSpace: 'sRGB',    // three r152+ color management
  },

  // ------------------------------------------------------------------
  // Camera (Tech Spec §3.1)
  // ------------------------------------------------------------------
  camera: {
    fov: 60,
    near: 0.1,
    far: 100,
    // M3: y is now driven by player eyeHeight. XZ kept as the spawn point.
    initialPosition: { x: 0, y: 1.7, z: 10 },  // 10m from artwork, natural eye height
    lookAt: { x: 0, y: 3.0, z: 0 },            // Face the rose window center (raised 1m)
  },

  // ------------------------------------------------------------------
  // Scene (Tech Spec §2.2)
  // ------------------------------------------------------------------
  scene: {
    roseWindowCenter: { x: 0, y: 3.0, z: 0 },  // Raised 1m (was 2.0)
    fog: null,                                // No fog in current version (minimal scene)
  },

  // ------------------------------------------------------------------
  // M2 — Floor (Global Requirement: white floor only, no ceiling/walls)
  // ------------------------------------------------------------------
  floor: {
    size: 60,                // 60x60 m plane, gives player ample movement room (M3)
    color: 0x808080,         // Medium-dark gray — darker to further reduce floor presence
    roughness: 0.85,         // Matte, not mirror — supports a calm exhibition tone
    metalness: 0.0,
    receiveShadow: false,    // Shadows disabled for now (no shadow-casting lights in M2)
    segments: 1,             // A flat plane needs no subdivision
  },

  // ------------------------------------------------------------------
  // M2 — Lighting (Tech Spec Task 2.2)
  // ------------------------------------------------------------------
  lighting: {
    ambient: {
      enabled: true,
      color: 0xffffff,
      intensity: 0.22,       // Slightly dimmed so additive light particles read as the brightest thing
    },
    directional: {
      enabled: true,
      color: 0xffffff,
      intensity: 0.6,        // Slightly dimmed key light
      // Position relative to rose window center — shines from upper-front
      position: { x: 5, y: 8, z: 6 },
      castShadow: false,     // Keep M2 lightweight; shadows are an M7 concern
    },
    hemisphere: {
      // Subtle sky/ground gradient for natural ambient feel
      enabled: true,
      skyColor: 0xe8eef5,
      groundColor: 0x202028,
      intensity: 0.15,
    },
    hdr: {
      // Optional HDR environment (Tech Spec §2.2 / Task 2.2 "HDR Environment (optional)")
      enabled: true,
      path: './assets/hdr/environment.hdr',
      environmentIntensity: 0.4,   // Reduced so particles dominate the visual
      background: false,           // Do not render HDR as visible background (keep dark hall)
    },
  },

  // ------------------------------------------------------------------
  // M2 — Rose Window Model (Tech Spec §4.1: GLB preferred, PNG fallback)
  // ------------------------------------------------------------------
  roseWindow: {
    modelPath: './assets/models/rose-window.glb',
    fallbackTexturePath: './assets/textures/rose-window-fallback.png', // Reserved for M4 PNG fallback
    // Target display size — the model's bounding box longest dimension is
    // normalized to this value so the artwork reads well from 10m away.
    targetSize: 6.0,             // ~6m diameter — 1.5× larger for a more prominent artwork
    centerOffset: { x: 0, y: 0, z: 0 },  // Extra fine-tune offset on top of roseWindowCenter
    // The GLB may be authored in any orientation; rotate so the window faces -Z
    // (toward the player at z=+10). Set to 0 if the model already faces -Z.
    rotationY: Math.PI,          // Default: face the player (rotate 180° around Y)
    // Optional: enable/disable the physical model rendering.
    // M4 will add the Light Point System on top; the physical model is shown in M2.
    visible: true,
  },

  // ------------------------------------------------------------------
  // M4 — Interactive Light Point System (Tech Spec §4; Interaction Spec §6)
  // ------------------------------------------------------------------
  lightPoints: {
    enabled: true,
    // Per-mesh absolute counts (independent — increase glass without touching frame).
    meshSampling: [
      { name: 'RoseWindow_Glass', count: 170000 },
      { name: 'RoseWindow_Frame', count: 30000 },
    ],

    point: {
      size: 0.055,             // Larger points for a softer, glowy look (was 0.03)
      sizeVariation: 0.4,      // Per-point random ±40% size
      opacity: 0.35,           // Low opacity — 100K additive big points accumulate to bright
                               // clusters naturally; high opacity overexposes to white.
      coreBoost: 0.0,          // No center overflow — additive accumulation already creates
                               // brightness; boost caused severe overexposure + color loss.
    },

    idle: {
      // Task 4.3 — breathing animation.
      enabled: true,
      amplitude: 0.025,         // Increased for more visible motion (was 0.012)
      frequency: 0.6,           // Hz
    },

    interaction: {
      // Task 4.4 / 4.5 — distance-driven displacement.
      // Trigger distances tripled for the larger scene (was 8.0 / 3.0).
      interactionRadius: 24.0,  // S1 Approach starts (3× original)
      explorationRadius: 9.0,   // S2 Exploration + node display starts (3× original)
      maxDisplacement: 0.45,    // Increased amplitude — ~15% of 3m radius (spec §6.3 max)
      spatialFalloff: 5.0,      // Increased so particles respond from further away (was 1.8)
      playerAvoidWeight: 0.25,  // Small component pushing points away from the player
    },

    blending: 'Additive',       // Additive = luminous light, not physical matter (Design §2.2)
    depthWrite: false,
    hidePhysicalModel: true,    // After sampling, hide the GLB — points ARE the artwork (Spec §4.2)

    // M8: dissipation — far from the window, particles fade out and the physical
    // model fades in (cross-dissolve). "Distance = matter, proximity = light."
    dissipation: {
      enabled: true,
      startDistance: 20.0,     // Particles start fading here (overlaps with interaction zone edge)
      endDistance: 30.0,       // boundary — particles fully gone, model fully visible
    },
  },

  // ------------------------------------------------------------------
  // Post-Processing — Bloom (extracts bright additive cores → glow halos)
  // ------------------------------------------------------------------
  postProcessing: {
    enabled: true,
    bloom: {
      enabled: true,
      strength: 0.3,      // Reduced — was over-glowing the whole window
      radius: 0.5,        // Bloom spread
      threshold: 0.25,    // Raised — only genuine bright additive clusters bloom, not the whole scene
    },
  },

  // ------------------------------------------------------------------
  // M5 — Information Node System (Tech Spec §7; Interaction Spec §6, §7)
  // ------------------------------------------------------------------
  infoNodes: {
    enabled: true,
    nodeSize: 0.12,              // Sphere radius (meters) — small, doesn't compete with the window
    color: 0x88ccff,            // Soft blue glass tone
    emissive: 0x4488ff,
    emissiveIntensity: 0.6,
    hoverScale: 1.4,            // Scale multiplier when the crosshair aims at a node
    hoverEmissiveBoost: 1.5,    // Emissive multiplier when hovered
    pulseAmplitude: 0.08,       // Breathing scale variation
    pulseFrequency: 1.2,        // Hz
    fadeInDuration: 0.4,        // Seconds per node to go 0→1 opacity
    fadeInStagger: 0.15,        // Delay between consecutive nodes
    fadeOutDuration: 0.3,
    raycastRadius: 0.25,        // Generous hit radius — easier to aim with the crosshair
    // 5 nodes surrounding the rose window edge (center 0,3,0; window radius ~3m).
    // All at z=+0.8 (in front of the window, toward the player) so all are visible.
    // None block the window center. Topics per Design Doc §2.3.
    positions: [
      { id: 'color',         pos: { x: 3.8,  y: 3.0, z: 0.8 }, title: '色彩', color: 0xff6b6b },
      { id: 'light',         pos: { x: 2.4,  y: 5.0, z: 0.8 }, title: '光',   color: 0xd38290 },
      { id: 'architecture',  pos: { x: -2.4, y: 5.0, z: 0.8 }, title: '建筑', color: 0xa698b5 },
      { id: 'craftsmanship', pos: { x: -3.8, y: 3.0, z: 0.8 }, title: '工艺', color: 0x79aeda },
      { id: 'history',       pos: { x: 0,    y: 1.2, z: 0.8 }, title: '历史', color: 0x4dc4ff },
    ],
  },

  // ------------------------------------------------------------------
  // M3 — Player Controller (Tech Spec §3.2, §3.3; Interaction Spec §9)
  // ------------------------------------------------------------------
  player: {
    eyeHeight: 1.7,              // Natural first-person eye height (meters)
    // Spawn point on the XZ plane — player should immediately see the rose window.
    spawn: { x: 0, z: 10 },      // 10m from artwork (Tech Spec §3.3)

    // Movement (Tech Spec §3.2: WASD + Mouse Look; Shift Sprint optional)
    moveSpeed: 2.6,              // Calm gallery walk (m/s)
    sprintSpeed: 5.0,            // Shift sprint (m/s)
    acceleration: 12.0,          // How quickly velocity ramps toward target (m/s²)
    damping: 10.0,               // How quickly velocity decays when no input (1/s)
    sprintEnabled: true,         // Optional Shift sprint (Tech Spec §3.2 "Optional")

    // Mouse look
    pointerLock: true,           // Use PointerLockControls for mouse look
    mouseSensitivity: 1.0,       // Multiplier on PointerLockControls default sensitivity

    // Movement clamp (Task 3.2: player cannot leave the exhibition space)
    boundary: {
      // Outer boundary — circular keeps the rose window centered in the room.
      mode: 'circular',          // 'circular' | 'rectangular'
      radius: 30.0,              // Expanded from 25 to give room for the dissipation transition (M8)
      halfSize: { x: 25, z: 25 },// For rectangular: ±halfSize from origin
    },
    artworkExclusion: {
      // Minimum XZ distance the player may approach the rose window center.
      // Keeps the player from walking through the window while still allowing
      // the <3m "Exploration" distance from Interaction Spec §6.
      enabled: true,
      radius: 1.2,               // Don't get closer than 1.2m to window center on XZ
    },
  },

  // ------------------------------------------------------------------
  // M1 verification markers — disabled by default in M2.
  // Kept for debugging; turn on to see the old test cube + axes.
  // ------------------------------------------------------------------
  verification: {
    showAxesHelper: false,
    axesSize: 3,
    showTestCube: false,
    cubeSize: 1,
    cubeColor: 0x4ecdc4,
    cubeRotationSpeed: 0.5,
  },

  // ------------------------------------------------------------------
  // Render Loop (Tech Spec §11)
  // ------------------------------------------------------------------
  renderLoop: {
    targetFPS: 60,
  },
};
