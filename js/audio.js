"use strict";

// Alle Sounds werden prozedural per WebAudio erzeugt – keine Audiodateien nötig.
class SFX {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.master = null;
    this.noiseBuf = null;
    this.ambientNode = null;
  }

  // Muss nach einer Nutzergeste aufgerufen werden (Browser-Autoplay-Regel)
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") this.ctx.resume();
      return;
    }
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      return;
    }
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 1;
    this.master.connect(this.ctx.destination);

    const len = this.ctx.sampleRate * 2;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = this.noiseBuf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      // leicht gefärbtes Rauschen klingt natürlicher als weißes
      const white = Math.random() * 2 - 1;
      last = (last + 0.04 * white) / 1.04;
      data[i] = last * 4.5;
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) {
      this.master.gain.setTargetAtTime(this.muted ? 0 : 1, this.ctx.currentTime, 0.02);
    }
    return this.muted;
  }

  _noise(dur, filterType, freq, q, gain, when = 0) {
    if (!this.ctx) return null;
    const t = this.ctx.currentTime + when;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = filterType;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + dur + 0.05);
    return { g, t };
  }

  _tone(type, f0, f1, dur, gain, when = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  _whistleBlast(dur, when = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator();
    o.type = "square";
    o.frequency.value = 2350;
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 42; // Trillerpfeifen-Flattern
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 320;
    lfo.connect(lfoGain).connect(o.frequency);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.09, t + 0.02);
    g.gain.setValueAtTime(0.09, t + dur - 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
    lfo.start(t);
    lfo.stop(t + dur + 0.02);
  }

  whistleKickoff() {
    this._whistleBlast(0.32);
  }

  whistleGoal() {
    this._whistleBlast(0.26);
    this._whistleBlast(0.26, 0.32);
  }

  whistleFull() {
    this._whistleBlast(0.22);
    this._whistleBlast(0.22, 0.28);
    this._whistleBlast(0.75, 0.56);
  }

  kick(power) {
    const p = clamp(power, 0.2, 1);
    this._noise(0.09, "highpass", 500, 0.8, 0.16 * p);
    this._tone("sine", 110, 55, 0.1, 0.32 * p);
  }

  bounce() {
    this._tone("sine", 150, 70, 0.06, 0.12);
  }

  post() {
    this._tone("triangle", 640, 620, 0.28, 0.2);
    this._tone("triangle", 1280, 1220, 0.18, 0.07);
  }

  catchBall() {
    this._noise(0.08, "lowpass", 350, 0.6, 0.25);
  }

  cheer() {
    // anschwellender Publikumsjubel
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = 950;
    f.Q.value = 0.4;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.4, t + 0.25);
    g.gain.setValueAtTime(0.4, t + 1.1);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.4);
    src.connect(f).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + 2.5);
  }

  startAmbient() {
    if (!this.ctx || this.ambientNode) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = 800;
    f.Q.value = 0.3;
    const g = this.ctx.createGain();
    g.gain.value = 0.028; // leises Stadion-Grundrauschen
    src.connect(f).connect(g).connect(this.master);
    src.start();
    this.ambientNode = src;
  }
}

const sfx = new SFX();
