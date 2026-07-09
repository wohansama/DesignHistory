// UIFeedbackAudio — procedurally synthesized UI feedback sounds.
//
// All sounds are generated via the Web Audio API (no external audio files).
// Every sound is intentionally very quiet so it never competes with the artwork
// or any future ambient audio layer.
//
// Sound palette:
//   playClick()      — Glass touch: short noise transient + high-freq sine ring
//   playPanelOpen()  — Gentle ascending dual-tone chime
//   playPanelClose() — Gentle descending dual-tone chime
//   playHover()      — Barely-there high-frequency ping (150ms debounced)

import { CONFIG } from '../config/Config.js';

export class UIFeedbackAudio {
  constructor() {
    const c = CONFIG.uiAudio;
    this._enabled = c.enabled;
    this._config = c;

    this._ctx = null;
    this._masterGain = null;
    this._lastHoverTime = 0;   // debounce tracking

    this._started = false;
  }

  // ------------------------------------------------------------------
  // start() — create AudioContext + master gain.
  // MUST be called from a user-gesture callback (pointer-lock click).
  // ------------------------------------------------------------------
  start() {
    if (this._started || !this._enabled) return;
    try {
      this._ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      console.warn('[UIFeedbackAudio] Web Audio API not available.', e);
      this._enabled = false;
      return;
    }

    this._masterGain = this._ctx.createGain();
    this._masterGain.gain.value = this._config.masterVolume;
    this._masterGain.connect(this._ctx.destination);

    // Resume if suspended (browser autoplay policy).
    if (this._ctx.state === 'suspended') {
      this._ctx.resume();
    }

    this._started = true;
    console.log('[UIFeedbackAudio] Started (Web Audio API ready).');
  }

  // ------------------------------------------------------------------
  // playClick() — light glass-touch sound (100-300ms).
  //
  // Two layers:
  //   1. Very short noise burst → bandpass 3-6kHz → gain spike (~5ms)
  //      Simulates the initial "tap" transient.
  //   2. High-frequency sine ring at clickFreq Hz, exponential decay
  //      Simulates the glass resonance after the tap.
  // ------------------------------------------------------------------
  playClick() {
    if (!this._started) return;
    const c = this._config;
    const ctx = this._ctx;
    const now = ctx.currentTime;

    // Layer 1 — noise transient (sharp initial tap)
    const noiseLen = 0.008; // 8ms of noise
    const noiseBuf = ctx.createBuffer(1, ctx.sampleRate * noiseLen, ctx.sampleRate);
    const noiseData = noiseBuf.getChannelData(0);
    for (let i = 0; i < noiseData.length; i++) {
      noiseData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.0015));
    }
    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = noiseBuf;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = 4500;
    noiseFilter.Q.value = 2.5;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.7, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.01);
    noiseSrc.connect(noiseFilter).connect(noiseGain).connect(this._masterGain);
    noiseSrc.start(now);
    noiseSrc.stop(now + noiseLen);

    // Layer 2 — sine ring (glass resonance)
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = c.clickFreq;
    const ringGain = ctx.createGain();
    ringGain.gain.setValueAtTime(0, now);
    ringGain.gain.linearRampToValueAtTime(0.5, now + 0.005);
    ringGain.gain.exponentialRampToValueAtTime(0.001, now + c.clickDuration);
    osc.connect(ringGain).connect(this._masterGain);
    osc.start(now);
    osc.stop(now + c.clickDuration + 0.05);
  }

  // ------------------------------------------------------------------
  // playPanelOpen() — soft ascending dual-tone chime (~400ms).
  //
  // Two sine oscillators sweep gently upward.
  // Envelope: slow attack, gentle hold, soft release.
  // ------------------------------------------------------------------
  playPanelOpen() {
    if (!this._started) return;
    const c = this._config;
    const ctx = this._ctx;
    const now = ctx.currentTime;
    const dur = 0.4;
    const vol = 0.6;

    this._playDualSweep(
      c.panelFreqLow, c.panelFreqLow * 1.26,   // 440 → 554
      c.panelFreqHigh, c.panelFreqHigh * 1.26,  // 554 → 698
      vol, now, dur,
      'up'   // frequency ramps up
    );
  }

  // ------------------------------------------------------------------
  // playPanelClose() — soft descending dual-tone chime (~300ms).
  // ------------------------------------------------------------------
  playPanelClose() {
    if (!this._started) return;
    const c = this._config;
    const ctx = this._ctx;
    const now = ctx.currentTime;
    const dur = 0.3;
    const vol = 0.55;

    this._playDualSweep(
      c.panelFreqLow * 1.26, c.panelFreqLow,   // 554 → 440
      c.panelFreqHigh * 1.26, c.panelFreqHigh,  // 698 → 554
      vol, now, dur,
      'down' // frequency ramps down
    );
  }

  // ------------------------------------------------------------------
  // playHover() — barely-there high-frequency ping (~50ms).
  //
  // Debounced at 150ms so rapid crosshair movements don't spam sounds.
  // ------------------------------------------------------------------
  playHover() {
    if (!this._started) return;
    const c = this._config;
    const ctx = this._ctx;
    const now = ctx.currentTime;

    // Debounce — only one hover ping per hoverDebounce ms.
    const elapsed = (now - this._lastHoverTime) * 1000;
    if (elapsed < c.hoverDebounce) return;
    this._lastHoverTime = now;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = c.hoverFreq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.25, now + 0.003);   // very fast attack
    g.gain.exponentialRampToValueAtTime(0.001, now + c.hoverDuration); // quick decay
    osc.connect(g).connect(this._masterGain);
    osc.start(now);
    osc.stop(now + c.hoverDuration + 0.02);
  }

  // ------------------------------------------------------------------
  // dispose() — clean up audio resources.
  // ------------------------------------------------------------------
  dispose() {
    if (this._ctx && this._ctx.state !== 'closed') {
      this._ctx.close();
    }
    this._ctx = null;
    this._masterGain = null;
    this._started = false;
  }

  // ==================================================================
  // Internal helpers
  // ==================================================================

  // Play two sine oscillators that sweep between start/end frequencies.
  // `direction`: 'up' (ascending, open panel) or 'down' (descending, close panel).
  _playDualSweep(freq1Start, freq1End, freq2Start, freq2End, volume, now, duration, direction) {
    const ctx = this._ctx;

    // Envelope shape depends on direction.
    // open (up): slow attack, peaks then decays gently
    // close (down): fast attack, decays steadily
    const attackEnd = direction === 'up' ? now + duration * 0.25 : now + 0.02;
    const peakVal = volume;
    const sustainVal = volume * 0.35;
    const decayStart = direction === 'up' ? now + duration * 0.7 : now + duration * 0.3;

    const makeOsc = (fStart, fEnd) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(fStart, now);
      osc.frequency.linearRampToValueAtTime(fEnd, now + duration);
      return osc;
    };

    const makeGain = () => {
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(peakVal, attackEnd);
      g.gain.linearRampToValueAtTime(sustainVal, decayStart);
      g.gain.exponentialRampToValueAtTime(0.001, now + duration + 0.05);
      return g;
    };

    const osc1 = makeOsc(freq1Start, freq1End);
    const osc2 = makeOsc(freq2Start, freq2End);
    const gain1 = makeGain();
    const gain2 = makeGain();
    // Second osc slightly quieter for harmonic depth.
    gain2.gain.value = 0; // reset, envelope handles rest
    // Override: set second osc peak to 0.7× first
    // (we do this by re-creating the gain envelope with lower peak)
    gain2.gain.cancelScheduledValues(now);
    gain2.gain.setValueAtTime(0, now);
    gain2.gain.linearRampToValueAtTime(peakVal * 0.65, attackEnd);
    gain2.gain.linearRampToValueAtTime(sustainVal * 0.65, decayStart);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + duration + 0.05);

    osc1.connect(gain1).connect(this._masterGain);
    osc2.connect(gain2).connect(this._masterGain);
    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + duration + 0.1);
    osc2.stop(now + duration + 0.1);
  }
}
