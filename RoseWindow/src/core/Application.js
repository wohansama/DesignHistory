// Application — lifecycle orchestration root.
//
// Event Flow (Tech Spec §15), updated through M3:
//
//   Application Start
//     → Load Assets (ResourceManager.loadAll)
//     → Initialize Scene (floor + rose window + lighting + HDR env)   [M2]
//     → Player Spawn (PlayerController)                                 [M3]
//     → Start Update Loop
//     → Player movement + clamp update                                  [M3]
//     → Distance Detection (M4 — not yet)
//     → Interaction Update (M4+ — not yet)
//     → Rendering

import * as THREE from 'three';
import { CONFIG } from '../config/Config.js';
import { createRenderer } from './Renderer.js';
import { createCamera } from './Camera.js';
import { createScene } from './Scene.js';
import { setupResize } from './ResizeHandler.js';
import { createRenderLoop } from './RenderLoop.js';
import { ResourceManager } from '../resources/ResourceManager.js';
import { createFloor } from '../scene/Floor.js';
import { createLighting, applyHDREnvironment } from '../scene/Lighting.js';
import { createRoseWindowModel } from '../scene/RoseWindowModel.js';
import { PlayerController } from '../player/PlayerController.js';
import { LightPointSystem } from '../lightpoints/LightPointSystem.js';
import { InfoNodeSystem } from '../info-nodes/InfoNodeSystem.js';
import { InfoPanel } from '../info-panel/InfoPanel.js';
import { PANEL_CONTENT } from '../info-panel/panel-content.js';
import { createPostProcessing } from './PostProcessing.js';

export class Application {
  constructor(container) {
    this.container = container;
    this.renderer = createRenderer(container);
    this.camera = createCamera();
    this.scene = createScene();

    // Post-processing (bloom) — created early so the resize handler can keep it in sync.
    this._postProcessing = createPostProcessing({
      renderer: this.renderer,
      scene: this.scene,
      camera: this.camera,
    });
    this._disposeResize = setupResize(this.camera, this.renderer, this._postProcessing);

    // ResourceManager needs the renderer for PMREMGenerator.
    this.resources = new ResourceManager(this.renderer);

    // Hold references for cleanup / future milestones.
    this._floor = null;
    this._lighting = null;
    this._roseWindow = null;
    this._player = null;
    this._lightPoints = null;
    this._infoNodes = null;

    this.loop = createRenderLoop({
      scene: this.scene,
      camera: this.camera,
      renderer: this.renderer,
      renderFn: this._postProcessing ? () => this._postProcessing.render() : null,
      onUpdate: (dt) => this._update(dt),
    });

    this._started = false;
  }

  // ------------------------------------------------------------------
  // Boot sequence — async because asset loading is async.
  // ------------------------------------------------------------------
  async start() {
    if (this._started) return;
    this._started = true;

    console.log('[M3] Booting Rose Window exhibition...');

    // 1. Load all assets up front (Tech Spec §15).
    const manifest = {
      models: [
        { name: 'roseWindow', path: CONFIG.roseWindow.modelPath },
      ],
      hdr: CONFIG.lighting.hdr.enabled
        ? { path: CONFIG.lighting.hdr.path }
        : null,
    };

    try {
      await this.resources.loadAll(manifest, (loaded, total, url) => {
        console.log(`[M3] Asset ${loaded}/${total}: ${url}`);
      });
    } catch (err) {
      console.error('[M3] Asset loading failed; scene may be incomplete.', err);
      // We continue so the user at least sees the floor + lighting.
    }

    // 2. Build the scene contents now that assets are available.
    this._buildScene();

    // 3. Spawn the player and wire up the pointer-lock UI (M3).
    this._initPlayer();

    // 4. Generate the Interactive Light Point System (M4) — samples the placed model.
    this._initLightPoints();

    // 5. Create the Information Node System (M5) — five nodes around the artwork.
    this._initInfoNodes();

    // 6. Start the render loop.
    this.loop.start();
    console.log('[M5] Rose Window exhibition started. Click to enter.');
  }

  // ------------------------------------------------------------------
  // Scene assembly — floor + rose window + lighting + HDR env.
  // ------------------------------------------------------------------
  _buildScene() {
    // Floor — hidden (night sky scene has no ground; player floats in space).
    this._floor = createFloor();
    this._floor.visible = false;
    this.scene.add(this._floor);

    // Rose window (may be null if the GLB failed to load).
    this._roseWindow = createRoseWindowModel(this.resources, 'roseWindow');
    if (this._roseWindow) {
      this.scene.add(this._roseWindow);
    }

    // Lighting rig.
    this._lighting = createLighting();
    this.scene.add(this._lighting);

    // HDR environment → PBR reflections + visible night sky background.
    if (CONFIG.lighting.hdr.enabled) {
      const envMap = this.resources.getHDREnvironment();
      applyHDREnvironment(this.scene, envMap);
      if (CONFIG.lighting.hdr.background) {
        // Use the original high-res equirectangular texture (PMREM is blurry for background).
        this.scene.background = this.resources.getHDREquirectangular();
      }
    }
  }

  // ------------------------------------------------------------------
  // Player (M3) — first-person controller + pointer-lock UI.
  // ------------------------------------------------------------------
  _initPlayer() {
    this._player = new PlayerController(this.camera, this.renderer.domElement);

    // Pointer-lock UI: the overlay is an HTML element (#start-overlay) that the
    // user clicks to request pointer lock (browsers require a user gesture).
    // While locked the overlay hides; pressing ESC releases the lock and the
    // overlay reappears so the user can re-enter.
    const overlay = document.getElementById('start-overlay');

    this._player.onLock(() => {
      if (overlay) overlay.classList.add('hidden');
      console.log('[M3] Pointer locked — player control active.');
    });
    this._player.onUnlock(() => {
      if (overlay) overlay.classList.remove('hidden');
      console.log('[M3] Pointer unlocked — paused.');
    });

    if (overlay) {
      // Clicking the overlay (or the canvas) requests pointer lock.
      overlay.addEventListener('click', () => this._player.lock());
    }
    // Also allow clicking directly on the canvas to re-lock after ESC.
    // Stored so M5's _initInfoNodes can upgrade it to also handle node clicks.
    this._canvasClickHandler = () => {
      if (!this._player.isLocked()) this._player.lock();
    };
    this.renderer.domElement.addEventListener('click', this._canvasClickHandler);
  }

  // ------------------------------------------------------------------
  // Light Point System (M4) — sample the placed model and build the point cloud.
  // ------------------------------------------------------------------
  _initLightPoints() {
    if (!CONFIG.lightPoints.enabled) return;

    this._lightPoints = new LightPointSystem(this.scene);
    const ok = this._lightPoints.generate(this.resources);
    if (!ok) {
      console.warn('[M4] Light point system generation failed.');
      return;
    }

    // Push the physical model 0.5m behind the particles (which are already baked
    // into the BufferGeometry at the model's original position). During the
    // cross-dissolve, particles float in front of the physical window — spatial depth.
    if (this._roseWindow) {
      this._roseWindow.position.z -= 0.5;
    }

    // The points ARE the artwork now (Tech Spec §4.2). Hide the physical model,
    // but prepare its materials for the M8 dissipation cross-fade (far away → model appears).
    this._modelMeshes = [];
    if (CONFIG.lightPoints.hidePhysicalModel && this._roseWindow) {
      this._roseWindow.traverse((obj) => {
        if (obj.isMesh) {
          obj.material.transparent = true;
          obj.material.opacity = 0;  // Start invisible — particles dominate up close
          this._modelMeshes.push(obj);
        }
      });
      this._roseWindow.visible = false;
      console.log('[M4/M8] Physical model hidden, materials prepped for dissipation cross-fade.');
    }
  }

  // ------------------------------------------------------------------
  // Information Node System (M5) — five interactive nodes + crosshair UI.
  // ------------------------------------------------------------------
  _initInfoNodes() {
    if (!CONFIG.infoNodes.enabled) return;

    this._infoNodes = new InfoNodeSystem(this.scene, this.camera, this.renderer.domElement);
    this._infoNodes.createNodes();

    // M6: information panel — opens when a node is selected.
    this._infoPanel = new InfoPanel();

    // Crosshair UI: show when pointer is locked, highlight when hovering a node.
    const crosshair = document.getElementById('crosshair');
    this._crosshair = crosshair;

    this._player.onLock(() => {
      if (crosshair) crosshair.classList.add('visible');
    });
    this._player.onUnlock(() => {
      if (crosshair) crosshair.classList.remove('visible', 'hover');
      // ESC (pointer unlock) closes the panel.
      this._infoPanel?.close();
    });

    // Hover feedback → crosshair changes color
    this._infoNodes.onHoverChange = (isHovering) => {
      if (crosshair) crosshair.classList.toggle('hover', isHovering);
    };

    // M6: Selection → open the info panel with the topic's content.
    this._infoNodes.onSelect = (data) => {
      const content = PANEL_CONTENT[data.id];
      if (content) {
        this._infoPanel.open(content, data.id);
      }
    };

    // Click: when locked — if hovering a node, select it (opens/replaces panel);
    // if NOT hovering a node and panel is open, close the panel.
    // When unlocked — re-lock.
    this.renderer.domElement.removeEventListener('click', this._canvasClickHandler);
    this._canvasClickHandler = () => {
      if (this._player.isLocked()) {
        if (this._infoNodes._hoveredNode) {
          // Hovering a node → select (opens or replaces panel)
          this._infoNodes.onClick();
        } else if (this._infoPanel?.isOpen()) {
          // Not hovering a node + panel open → close panel
          this._infoPanel.close();
        }
      } else {
        this._player.lock();
      }
    };
    this.renderer.domElement.addEventListener('click', this._canvasClickHandler);
  }

  // ------------------------------------------------------------------
  // Per-frame update.
  // ------------------------------------------------------------------
  _update(dt) {
    // M3: drive the player controller every frame.
    if (this._player) this._player.update(dt);
    // M4: update the light point system with the player's current position.
    if (this._lightPoints) this._lightPoints.update(dt, this.camera.position);
    // M5: update info nodes — fade in/out based on interaction state + crosshair hover.
    if (this._infoNodes && this._lightPoints) {
      const state = this._lightPoints.getState();
      this._infoNodes.update(dt, state);
      // M6: auto-close the panel when the player leaves exploration range.
      if (this._infoPanel?.isOpen() && state !== 'exploration') {
        this._infoPanel.close();
      }
    }
    // M8: dissipation cross-fade — far away, particles fade out & physical model fades in.
    if (this._lightPoints && this._roseWindow && this._modelMeshes) {
      const factor = this._lightPoints.getDissipationFactor();
      const modelOpacity = 1.0 - factor;
      if (modelOpacity > 0.005) {
        this._roseWindow.visible = true;
        for (const mesh of this._modelMeshes) {
          mesh.material.opacity = modelOpacity;
        }
      } else {
        this._roseWindow.visible = false;
      }
    }
  }

  // ------------------------------------------------------------------
  // Lifecycle
  // ------------------------------------------------------------------
  stop() {
    this.loop.stop();
  }

  dispose() {
    this.stop();
    this._infoNodes?.dispose();
    this._lightPoints?.dispose();
    this._player?.dispose();
    this._postProcessing?.dispose();
    this._disposeResize();
    this.resources.dispose();

    // Dispose scene geometries/materials we created.
    this._floor?.geometry?.dispose();
    this._floor?.material?.dispose();

    this.renderer.dispose();
  }
}
