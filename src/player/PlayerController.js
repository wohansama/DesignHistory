// PlayerController — first-person controller (Tech Spec §3.2, §3.3; Interaction Spec §9).
//
// Architecture:
//   - Mouse look: delegated to three's PointerLockControls (handles yaw/pitch,
//     pointer-lock lifecycle). We only use it for orientation — NOT for movement.
//   - WASD movement: self-implemented with smooth velocity damping on the XZ plane.
//     The camera never flies (Y is locked to eyeHeight).
//   - Shift sprint: optional speed boost (Tech Spec §3.2 "Optional: Shift Sprint").
//   - Movement clamp (Task 3.2): outer boundary + artwork exclusion, applied every
//     frame so the player can never leave the exhibition space or walk through the
//     rose window. Clamping is continuous (no teleport), satisfying Interaction Spec
//     §10 ("no instant state switching").
//
// Interaction Spec §9 guarantees:
//   - The player can always look around freely. ✅ (pointer lock, no camera lock)
//   - The player can always move freely inside the exhibition. ✅ (WASD always active)

import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { CONFIG } from '../config/Config.js';

// Reusable temp vectors — avoid per-frame allocations.
const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _desired = new THREE.Vector3();
const _xzPos = new THREE.Vector2();

export class PlayerController {
  /**
   * @param {THREE.Camera} camera
   * @param {HTMLElement} domElement  The element that requests pointer lock (usually renderer.domElement).
   */
  constructor(camera, domElement) {
    this.camera = camera;
    this.domElement = domElement;
    this.cfg = CONFIG.player;

    // --- Mouse look via PointerLockControls ---
    this.controls = new PointerLockControls(camera, domElement);
    this.controls.pointerSpeed = this.cfg.mouseSensitivity;

    // --- Movement state ---
    // Velocity is on the XZ plane (y always 0 here); camera Y is set from eyeHeight.
    this.velocity = new THREE.Vector3();
    this.keys = { forward: false, back: false, left: false, right: false, sprint: false };

    // --- Place the player at spawn ---
    this.resetPosition();

    // --- Input listeners ---
    this._onKeyDown = (e) => this._handleKey(e, true);
    this._onKeyUp = (e) => this._handleKey(e, false);
    document.addEventListener('keydown', this._onKeyDown);
    document.addEventListener('keyup', this._onKeyUp);

    // Expose lock/unlock so the Application/UI can drive pointer lock.
    // lock() must be called from a user gesture (click) per browser policy.
  }

  // ------------------------------------------------------------------
  // Positioning
  // ------------------------------------------------------------------
  resetPosition() {
    const eye = this.cfg.eyeHeight;
    this.camera.position.set(this.cfg.spawn.x, eye, this.cfg.spawn.z);
    this.velocity.set(0, 0, 0);
    // Look toward the rose window center initially.
    const c = CONFIG.scene.roseWindowCenter;
    this.camera.lookAt(c.x, c.y, c.z);
  }

  // ------------------------------------------------------------------
  // Pointer-lock lifecycle (delegated)
  // ------------------------------------------------------------------
  lock() {
    this.controls.lock();
  }

  unlock() {
    this.controls.unlock();
  }

  isLocked() {
    return this.controls.isLocked;
  }

  onLock(cb) {
    this.controls.addEventListener('lock', cb);
  }

  onUnlock(cb) {
    this.controls.addEventListener('unlock', cb);
  }

  // ------------------------------------------------------------------
  // Keyboard input
  // ------------------------------------------------------------------
  _handleKey(e, pressed) {
    switch (e.code) {
      case 'KeyW':
      case 'ArrowUp':
        this.keys.forward = pressed;
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.keys.back = pressed;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        this.keys.left = pressed;
        break;
      case 'KeyD':
      case 'ArrowRight':
        this.keys.right = pressed;
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        if (this.cfg.sprintEnabled) this.keys.sprint = pressed;
        break;
      default:
        break;
    }
  }

  // ------------------------------------------------------------------
  // Per-frame update — call from the render loop with delta time in seconds.
  // ------------------------------------------------------------------
  update(dt) {
    // Clamp dt to avoid huge jumps when the tab was backgrounded.
    dt = Math.min(dt, 0.1);

    // Only process movement when pointer is locked (i.e. the player is "in" the app).
    // When unlocked (menu open), freeze movement but keep gravity-free Y lock.
    if (this.controls.isLocked) {
      this._updateMovement(dt);
    } else {
      // Decay velocity smoothly when the menu is up so motion doesn't snap.
      this._decayVelocity(dt);
    }

    // Always enforce Y at eye height (no flying, no falling).
    this.camera.position.y = this.cfg.eyeHeight;

    // Always enforce boundary + artwork exclusion clamps (Task 3.2).
    this._clampPosition();
  }

  // ------------------------------------------------------------------
  // Movement core
  // ------------------------------------------------------------------
  _updateMovement(dt) {
    const cfg = this.cfg;

    // 1. Determine the desired movement direction in world space (XZ only).
    //    Read the camera's forward direction and strip the Y component so we
    //    walk on the floor regardless of where the player looks (up/down).
    this.camera.getWorldDirection(_forward);
    _forward.y = 0;
    _forward.normalize();
    // Right = forward × up (right-handed).
    _right.crossVectors(_forward, _up).normalize();

    _desired.set(0, 0, 0);
    if (this.keys.forward) _desired.add(_forward);
    if (this.keys.back) _desired.sub(_forward);
    if (this.keys.right) _desired.add(_right);
    if (this.keys.left) _desired.sub(_right);

    const hasInput = _desired.lengthSq() > 0;
    if (hasInput) _desired.normalize();

    // 2. Target speed (walk or sprint).
    const speed = this.keys.sprint ? cfg.sprintSpeed : cfg.moveSpeed;

    // 3. Accelerate velocity toward (desired * speed); damp toward zero otherwise.
    //    Using exponential approach for frame-rate-independent smoothing:
    //      v += (target - v) * (1 - exp(-k * dt))
    const targetVx = hasInput ? _desired.x * speed : 0;
    const targetVz = hasInput ? _desired.z * speed : 0;

    const accelK = hasInput ? cfg.acceleration : cfg.damping;
    const blend = 1 - Math.exp(-accelK * dt);
    this.velocity.x += (targetVx - this.velocity.x) * blend;
    this.velocity.z += (targetVz - this.velocity.z) * blend;

    // 4. Integrate position on the XZ plane.
    this.camera.position.x += this.velocity.x * dt;
    this.camera.position.z += this.velocity.z * dt;
  }

  _decayVelocity(dt) {
    const blend = 1 - Math.exp(-this.cfg.damping * dt);
    this.velocity.x *= 1 - blend;
    this.velocity.z *= 1 - blend;
    // Still integrate the residual so the player coasts to a stop naturally.
    this.camera.position.x += this.velocity.x * dt;
    this.camera.position.z += this.velocity.z * dt;
  }

  // ------------------------------------------------------------------
  // Movement clamp (Task 3.2) — keeps the player inside the exhibition
  // and away from the rose window. Continuous, no teleport.
  // ------------------------------------------------------------------
  _clampPosition() {
    const pos = this.camera.position;

    // --- Outer boundary ---
    const b = this.cfg.boundary;
    if (b.mode === 'circular') {
      _xzPos.set(pos.x, pos.z);
      const dist = _xzPos.length();
      if (dist > b.radius) {
        _xzPos.multiplyScalar(b.radius / dist);
        pos.x = _xzPos.x;
        pos.z = _xzPos.y;
        // Kill outward velocity component so the player doesn't stick fighting the wall.
        this.velocity.x *= 0;
        this.velocity.z *= 0;
      }
    } else {
      // rectangular
      const hx = b.halfSize.x;
      const hz = b.halfSize.z;
      if (pos.x > hx) { pos.x = hx; this.velocity.x = 0; }
      else if (pos.x < -hx) { pos.x = -hx; this.velocity.x = 0; }
      if (pos.z > hz) { pos.z = hz; this.velocity.z = 0; }
      else if (pos.z < -hz) { pos.z = -hz; this.velocity.z = 0; }
    }

    // --- Artwork exclusion (don't walk through the rose window) ---
    const ex = this.cfg.artworkExclusion;
    if (ex.enabled) {
      const c = CONFIG.scene.roseWindowCenter;
      _xzPos.set(pos.x - c.x, pos.z - c.z);
      const dist = _xzPos.length();
      if (dist < ex.radius) {
        // Push the player back out to the exclusion radius.
        if (dist > 1e-5) {
          _xzPos.multiplyScalar(ex.radius / dist);
        } else {
          // Exactly on center — nudge toward +Z (toward spawn) to avoid divide-by-zero.
          _xzPos.set(0, ex.radius);
        }
        pos.x = c.x + _xzPos.x;
        pos.z = c.z + _xzPos.y;
        // Cancel inward velocity.
        this.velocity.x *= 0;
        this.velocity.z *= 0;
      }
    }
  }

  // ------------------------------------------------------------------
  // Cleanup
  // ------------------------------------------------------------------
  dispose() {
    document.removeEventListener('keydown', this._onKeyDown);
    document.removeEventListener('keyup', this._onKeyUp);
    this.controls.dispose();
  }
}
