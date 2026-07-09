// AmbientAudio — procedurally synthesized spatial ambient layer.
//
// Four layers of barely-perceptible sound create a living spatial atmosphere:
//   1. Low drone — dual-sine beating at ~1Hz, low-passed, breath-like
//   2. Air flow — pink noise, heavily low-passed, slow amplitude drift
//   3. Particles — white noise, high-passed, almost inaudible "air sparkle"
//   4. Reverb — ConvolverNode with procedural 4s decay impulse
//
// Design principle: the player should NOT actively notice the sound, but when
// it's removed the space feels dead. All volume changes are 3-second smooth
// ramps. No melody, no rhythm, no discernible patterns.
//
// Distance subtly modulates the layers: closer to the rose window = fuller,
// warmer air; farther = thinner, colder. Transitions are invisible.

import { CONFIG } from '../config/Config.js';

export class AmbientAudio {
  constructor() {
    const c = CONFIG.ambientAudio;
    this._enabled = c.enabled;
    this._cfg = c;

    this._ctx = null;
    this._masterGain = null;
    this._started = false;

    // Node references for per-layer modulation and cleanup.
    this._drone = null;
    this._air = null;
    this._particles = null;
    this._reverb = null;

    // LFO oscillator references for stop-on-dispose.
    this._lfos = [];

    // Last applied distance factor (for smoothing).
    this._currentFactor = 0;
    this._currentState = 'observation';
  }

  // ==================================================================
  // start() — create AudioContext + all layers + reverb bus.
  // MUST be called inside a user-gesture callback (pointer-lock click).
  // ==================================================================
  start() {
    if (this._started || !this._enabled) return;
    try {
      this._ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      console.warn('[AmbientAudio] Web Audio API not available.', e);
      this._enabled = false;
      return;
    }

    if (this._ctx.state === 'suspended') {
      this._ctx.resume();
    }

    // Master gain — extremely quiet overall.
    this._masterGain = this._ctx.createGain();
    this._masterGain.gain.value = this._cfg.masterVolume;
    this._masterGain.connect(this._ctx.destination);

    // Build the reverb bus first (other layers send to it).
    this._reverb = this._createReverb();

    // Build each sound layer.
    this._drone = this._createDrone();
    this._air = this._createAirFlow();
    this._particles = this._createParticles();

    this._started = true;
    console.log('[AmbientAudio] Started — spatial ambience alive.');
  }

  // ==================================================================
  // update(factor, state) — distance-driven subtle modulation.
  //   factor: 1.0 (close) → 0.0 (far), from LightPointSystem
  //   state:  'exploration' | 'approach' | 'observation'
  // All parameter changes use 3-second smooth ramps.
  // ==================================================================
  update(factor, state) {
    if (!this._started) return;

    // Guard against redundant updates (only modulate if factor changed meaningfully).
    if (Math.abs(factor - this._currentFactor) < 0.005 && state === this._currentState) return;
    this._currentFactor = factor;
    this._currentState = state;

    const cfg = this._cfg;
    const ctx = this._ctx;
    const now = ctx.currentTime;
    const t = cfg.transitionTime;

    // ---- Drone: fullness scales with proximity ----
    if (this._drone) {
      const droneVol = cfg.drone.volume * (0.6 + 0.4 * factor);
      this._drone.gain.gain.cancelScheduledValues(now);
      this._drone.gain.gain.setTargetAtTime(droneVol, now, t / 3);
    }

    // ---- Air flow: low-pass opens up when closer (warmer air) ----
    if (this._air) {
      const lpStart = cfg.airFlow.lowpassFreq * 0.75;  // 150Hz (far)
      const lpEnd = cfg.airFlow.lowpassFreq;            // 200Hz (close)
      const lpFreq = lpStart + (lpEnd - lpStart) * factor;
      this._air.filter.frequency.cancelScheduledValues(now);
      this._air.filter.frequency.setTargetAtTime(lpFreq, now, t / 3);
    }

    // ---- Particles: high-pass shifts lower when closer (richer sparkle) ----
    if (this._particles) {
      const hpStart = cfg.particles.highpassMax;        // 8000Hz (far, thinner)
      const hpEnd = cfg.particles.highpassFreq;          // 6000Hz (close, richer)
      const hpFreq = hpStart + (hpEnd - hpStart) * factor;
      this._particles.filter.frequency.cancelScheduledValues(now);
      this._particles.filter.frequency.setTargetAtTime(hpFreq, now, t / 3);
    }
  }

  // ==================================================================
  // dispose() — silence and release all audio resources.
  // ==================================================================
  dispose() {
    if (!this._started) return;

    // Stop all LFO oscillators.
    for (const osc of this._lfos) {
      try { osc.stop(); } catch (_) { /* already stopped */ }
    }
    this._lfos.length = 0;

    // Stop continuous oscillators.
    if (this._drone) {
      try { this._drone.osc1.stop(); } catch (_) {}
      try { this._drone.osc2.stop(); } catch (_) {}
    }
    if (this._air) {
      try { this._air.source.stop(); } catch (_) {}
    }
    if (this._particles) {
      try { this._particles.source.stop(); } catch (_) {}
    }

    // Disconnect everything from destination before closing.
    if (this._masterGain) {
      this._masterGain.disconnect();
      this._masterGain = null;
    }

    if (this._ctx && this._ctx.state !== 'closed') {
      this._ctx.close();
    }
    this._ctx = null;
    this._started = false;
    console.log('[AmbientAudio] Disposed — spatial ambience gone.');
  }

  // ==================================================================
  // Layer 1 — Low Drone
  // Two sine oscillators at 32Hz + 33Hz → 1Hz natural beating
  // → LFO amplitude modulation (±20%) → low-pass 80Hz → reverb send
  // ==================================================================
  _createDrone() {
    const cfg = this._cfg.drone;
    const ctx = this._ctx;

    // Dual oscillators for organic beating (not a "note", just a pressure).
    const osc1 = ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.value = cfg.freq1;
    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.value = cfg.freq2;

    // Sum them into a single gain stage.
    const oscSum = ctx.createGain();
    oscSum.gain.value = 0.5; // prevent clipping from two full-scale sines
    osc1.connect(oscSum);
    osc2.connect(oscSum);

    // Very slow LFO for amplitude breathing (0.05Hz → 20-second cycle).
    const lfo = this._createLFO(cfg.lfoRate);
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.value = 0.12; // ±12% modulation, subtle
    lfo.connect(lfoDepth);
    lfoDepth.connect(oscSum.gain); // modulates oscSum gain around 0.5

    // Low-pass for comfort — attenuate anything that could cause discomfort.
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cfg.lowpassFreq;
    filter.Q.value = 0.5; // gentle slope
    oscSum.connect(filter);

    // Final layer gain.
    const gain = ctx.createGain();
    gain.gain.value = cfg.volume;
    filter.connect(gain);

    // Dry + reverb send.
    gain.connect(this._masterGain);
    if (this._reverb) gain.connect(this._reverb.convolver);

    osc1.start(0);
    osc2.start(0);

    return { osc1, osc2, gain };
  }

  // ==================================================================
  // Layer 2 — Air Flow (pink noise, heavily low-passed)
  // Pink noise → low-pass 200Hz → slow LFO gain modulation
  // ==================================================================
  _createAirFlow() {
    const cfg = this._cfg.airFlow;
    const ctx = this._ctx;

    // Generate 10 seconds of pink noise, looped.
    const buf = this._generatePinkNoise(10);
    const source = ctx.createBufferSource();
    source.buffer = buf;
    source.loop = true;

    // Low-pass — only the deep, non-directional rumble of moving air.
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cfg.lowpassFreq;
    filter.Q.value = 0.5;
    source.connect(filter);

    // Slow gain modulation (0.03Hz → ~33-second cycle, barely moving).
    const lfo = this._createLFO(cfg.lfoRate);
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.value = 0.08; // ±8%, extremely subtle
    const gain = ctx.createGain();
    gain.gain.value = cfg.volume;
    lfo.connect(lfoDepth);
    lfoDepth.connect(gain.gain);
    filter.connect(gain);

    // Dry + reverb send.
    gain.connect(this._masterGain);
    if (this._reverb) gain.connect(this._reverb.convolver);

    source.start(0);

    return { source, filter, gain };
  }

  // ==================================================================
  // Layer 3 — Particles (white noise, high-passed, barely audible)
  // White noise → high-pass 6kHz → slow LFO gain modulation
  // Optional low-pass 12kHz to prevent harshness.
  // ==================================================================
  _createParticles() {
    const cfg = this._cfg.particles;
    const ctx = this._ctx;

    // Generate white noise buffer, looped.
    const buf = this._generateWhiteNoise(8);
    const source = ctx.createBufferSource();
    source.buffer = buf;
    source.loop = true;

    // High-pass — only the very top end, like dust in sunlight.
    const hpFilter = ctx.createBiquadFilter();
    hpFilter.type = 'highpass';
    hpFilter.frequency.value = cfg.highpassFreq;
    hpFilter.Q.value = 0.5;
    source.connect(hpFilter);

    // Optional low-pass to cap harshness (comfort guard).
    const lpFilter = ctx.createBiquadFilter();
    lpFilter.type = 'lowpass';
    lpFilter.frequency.value = 12000; // hard cap at 12kHz
    lpFilter.Q.value = 0.5;
    hpFilter.connect(lpFilter);

    // Slow gain modulation (0.07Hz → ~14-second cycle).
    const lfo = this._createLFO(cfg.lfoRate);
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.value = 0.15; // ±15%, the most dynamic layer but still whisper-quiet
    const gain = ctx.createGain();
    gain.gain.value = cfg.volume;
    lfo.connect(lfoDepth);
    lfoDepth.connect(gain.gain);
    lpFilter.connect(gain);

    // Dry + reverb send.
    gain.connect(this._masterGain);
    if (this._reverb) gain.connect(this._reverb.convolver);

    source.start(0);

    return { source, filter: hpFilter, gain };
  }

  // ==================================================================
  // Layer 4 — Spatial Reverb (ConvolverNode + procedural impulse)
  // White noise × exponential decay envelope, 4 seconds.
  // All layers send to this bus; wet signal mixed very low.
  // ==================================================================
  _createReverb() {
    const cfg = this._cfg.reverb;
    const ctx = this._ctx;

    const sampleRate = ctx.sampleRate;
    const length = Math.floor(sampleRate * cfg.duration);
    const impulse = ctx.createBuffer(2, length, sampleRate);

    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        const t = i / length;
        // Exponential decay envelope
        const envelope = Math.pow(1 - t, cfg.decay);
        // Early reflections: first 80ms are denser
        const early = i < sampleRate * 0.08 ? 1.4 : 1.0;
        data[i] = (Math.random() * 2 - 1) * envelope * early;
      }
    }

    const convolver = ctx.createConvolver();
    convolver.buffer = impulse;

    // Wet gain — very low, just enough to add "space".
    const wetGain = ctx.createGain();
    wetGain.gain.value = cfg.wetLevel;
    convolver.connect(wetGain);
    wetGain.connect(this._masterGain);

    return { convolver, wetGain };
  }

  // ==================================================================
  // Helpers
  // ==================================================================

  // Create a very slow LFO (e.g. 0.03–0.07 Hz). Outputs [-1, 1] sine.
  _createLFO(rate) {
    const osc = this._ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = rate;
    osc.start(0);
    this._lfos.push(osc);
    return osc;
  }

  // Generate a stereo buffer of pink noise (Paul Kellet refined method).
  _generatePinkNoise(durationSec) {
    const ctx = this._ctx;
    const sampleRate = ctx.sampleRate;
    const length = Math.floor(sampleRate * durationSec);
    const buf = ctx.createBuffer(2, length, sampleRate);

    // Paul Kellet pink noise coefficients.
    // Seven parallel low-pass stages approximate -3dB/oct (pink) from white.
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < length; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        // The output is the sum of all stages, normalized.
        let pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
        b6 = white * 0.115926;
        // Normalize to prevent clipping (empirical factor).
        data[i] = pink * 0.11;
      }
    }

    return buf;
  }

  // Generate a stereo buffer of plain white noise.
  _generateWhiteNoise(durationSec) {
    const ctx = this._ctx;
    const sampleRate = ctx.sampleRate;
    const length = Math.floor(sampleRate * durationSec);
    const buf = ctx.createBuffer(2, length, sampleRate);

    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * 0.5; // half-amplitude to leave headroom
      }
    }

    return buf;
  }
}
