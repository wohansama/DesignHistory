// InfoNodeSystem — five interactive information nodes around the rose window.
//
// Behavior (Interaction Spec §6, §7, §8):
//   S2 Exploration (<3m): nodes fade in sequentially, one after another.
//   Hover: crosshair aims at a node → node scales up + brightens.
//   Click: selects the node → stored for M6 (info panel).
//   Recovery (>8m): nodes fade out in reverse order.
//
// Nodes use MeshBasicMaterial (unlit) so they're always visible regardless of
// scene lighting — they are self-luminous markers, not lit objects. Each node
// has its own color along a red→blue ring gradient. userData.bloom=true tells
// the selective bloom pass to NOT darken them (so they bloom like the particles).

import * as THREE from 'three';
import { CONFIG } from '../config/Config.js';

export class InfoNodeSystem {
  constructor(scene, camera, domElement) {
    this.scene = scene;
    this.camera = camera;
    this.domElement = domElement;
    this.cfg = CONFIG.infoNodes;

    this.nodes = [];
    this._raycaster = new THREE.Raycaster();
    this._raycaster.far = 15;
    this._centerNDC = new THREE.Vector2(0, 0);
    this._hoveredNode = null;
    this._selectedNode = null;

    this._fadeState = 'hidden';   // 'hidden' | 'fadingIn' | 'visible' | 'fadingOut'
    this._fadeClock = 0;
  }

  // ------------------------------------------------------------------
  createNodes() {
    const cfg = this.cfg;
    const geometry = new THREE.SphereGeometry(cfg.nodeSize, 20, 20);

    for (const entry of cfg.positions) {
      const baseColor = new THREE.Color(entry.color);

      const material = new THREE.MeshBasicMaterial({
        color: baseColor.clone(),
        transparent: true,
        opacity: 0,
        depthWrite: true,       // Fix: write depth so the floor doesn't occlude nodes
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(entry.pos.x, entry.pos.y, entry.pos.z);
      mesh.renderOrder = 999;              // Render after the floor
      mesh.userData.nodeData = entry;
      mesh.userData.bloom = true;          // Selective bloom: don't darken this mesh
      this.scene.add(mesh);

      this.nodes.push({
        mesh,
        data: entry,
        baseColor,     // Stored for hover brightness boost
        opacity: 0,
      });
    }

    console.log(`[InfoNodeSystem] Created ${this.nodes.length} nodes.`);
  }

  // ------------------------------------------------------------------
  update(dt, playerState) {
    dt = Math.min(dt, 0.1);

    this._updateFade(dt, playerState);

    const anyVisible = this.nodes.some((n) => n.opacity > 0.01);
    if (anyVisible) {
      this._updateHover();
    } else {
      this._setHovered(null);
    }

    // Per-node: apply opacity + pulse + hover
    const t = performance.now() / 1000;
    for (let i = 0; i < this.nodes.length; i++) {
      const node = this.nodes[i];
      const mesh = node.mesh;

      mesh.material.opacity = node.opacity;

      // Pulse breathing
      const pulse = 1 + Math.sin(t * this.cfg.pulseFrequency * 6.2832 + i * 1.3) * this.cfg.pulseAmplitude;

      // Hover scale
      const isHovered = (node === this._hoveredNode);
      const hoverK = isHovered ? this.cfg.hoverScale : 1.0;
      mesh.scale.setScalar(pulse * hoverK);

      // Hover brightness boost (MeshBasicMaterial has no emissive — boost color instead)
      if (isHovered) {
        mesh.material.color.copy(node.baseColor).multiplyScalar(this.cfg.hoverEmissiveBoost);
      } else {
        mesh.material.color.copy(node.baseColor);
      }
    }
  }

  // ------------------------------------------------------------------
  // Fade state machine — sequential fade in, reverse fade out.
  // ------------------------------------------------------------------
  _updateFade(dt, playerState) {
    const cfg = this.cfg;

    if (playerState === 'exploration') {
      if (this._fadeState === 'hidden' || this._fadeState === 'fadingOut') {
        this._fadeState = 'fadingIn';
        this._fadeClock = 0;
      }
    } else {
      // Any non-exploration state → fade out
      if (this._fadeState === 'visible' || this._fadeState === 'fadingIn') {
        this._fadeState = 'fadingOut';
        this._fadeClock = 0;
        for (const node of this.nodes) {
          node._fadeOutStart = node.opacity;
        }
      }
    }

    if (this._fadeState === 'fadingIn') {
      this._fadeClock += dt;
      let allDone = true;
      for (let i = 0; i < this.nodes.length; i++) {
        const node = this.nodes[i];
        const startTime = i * cfg.fadeInStagger;
        const localT = this._fadeClock - startTime;
        if (localT <= 0) {
          node.opacity = 0;
          allDone = false;
        } else if (localT < cfg.fadeInDuration) {
          node.opacity = localT / cfg.fadeInDuration;
          allDone = false;
        } else {
          node.opacity = 1;
        }
      }
      if (allDone) this._fadeState = 'visible';

    } else if (this._fadeState === 'fadingOut') {
      this._fadeClock += dt;
      let allDone = true;
      const n = this.nodes.length;
      for (let i = 0; i < n; i++) {
        const node = this.nodes[i];
        // Reverse order: the LAST node (index n-1) fades FIRST (stagger 0).
        // Node at index i gets stagger = (n-1-i) * stagger.
        const startTime = (n - 1 - i) * cfg.fadeInStagger;
        const localT = this._fadeClock - startTime;
        const startOpacity = node._fadeOutStart ?? 1;
        if (localT <= 0) {
          node.opacity = startOpacity;
          allDone = false;
        } else if (localT < cfg.fadeOutDuration) {
          node.opacity = startOpacity * (1 - localT / cfg.fadeOutDuration);
          allDone = false;
        } else {
          node.opacity = 0;
        }
      }
      if (allDone) {
        this._fadeState = 'hidden';
        this._setHovered(null);
      }
    }
  }

  // ------------------------------------------------------------------
  _updateHover() {
    this._raycaster.setFromCamera(this._centerNDC, this.camera);
    const ray = this._raycaster.ray;
    const hitRadius = this.cfg.raycastRadius;
    let closest = null;
    let closestDist = Infinity;

    for (const node of this.nodes) {
      if (node.opacity < 0.3) continue;
      const center = node.mesh.position;
      const distToRay = ray.distanceToPoint(center);
      if (distToRay < hitRadius) {
        const distToCamera = this.camera.position.distanceTo(center);
        if (distToCamera < closestDist) {
          closestDist = distToCamera;
          closest = node;
        }
      }
    }
    this._setHovered(closest);
  }

  _setHovered(node) {
    if (this._hoveredNode === node) return;
    this._hoveredNode = node;
    if (this.onHoverChange) this.onHoverChange(node !== null);
  }

  // ------------------------------------------------------------------
  onClick() {
    if (this._hoveredNode) {
      this._selectedNode = this._hoveredNode;
      console.log(`[InfoNodeSystem] Selected: ${this._selectedNode.data.title} (${this._selectedNode.data.id})`);
      if (this.onSelect) this.onSelect(this._selectedNode.data);
      return this._selectedNode.data;
    }
    return null;
  }

  getSelectedNode() {
    return this._selectedNode ? this._selectedNode.data : null;
  }

  clearSelection() {
    this._selectedNode = null;
  }

  // ------------------------------------------------------------------
  dispose() {
    const geo = this.nodes[0]?.mesh.geometry;
    if (geo) geo.dispose();
    for (const node of this.nodes) {
      node.mesh.material.dispose();
      this.scene.remove(node.mesh);
    }
    this.nodes.length = 0;
  }
}
