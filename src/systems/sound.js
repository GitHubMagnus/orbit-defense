// Prozedurales Sound-System auf WebAudio-Basis — keine externen Audio-Dateien.
// Alle Effekte werden zur Laufzeit synthetisiert; dazu ein leises Ambient-Pad.
// Der AudioContext startet erst nach der ersten Nutzer-Interaktion (Browser-Regel).

const MUTE_KEY = 'orbitwache-muted';

export class Sound {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noiseBuffer = null;
    this.muted = localStorage.getItem(MUTE_KEY) === '1';
    this.lastShot = 0; // Rate-Limit für Dauerfeuer
  }

  // nach erster Nutzer-Geste aufrufen
  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.16;
      this.master.connect(this.ctx.destination);
      // Rausch-Puffer einmalig erzeugen
      const len = this.ctx.sampleRate * 1;
      this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this.startAmbient();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  get ready() {
    return !!this.ctx && !this.muted;
  }

  toggleMuted() {
    this.muted = !this.muted;
    localStorage.setItem(MUTE_KEY, this.muted ? '1' : '0');
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.16;
    return this.muted;
  }

  // ---------- Synthese-Bausteine ----------

  envGain(vol, attack, decay) {
    const g = this.ctx.createGain();
    const t = this.ctx.currentTime;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.001, t + attack + decay);
    g.connect(this.master);
    return g;
  }

  tone(type, f0, f1, dur, vol = 0.4, delay = 0) {
    if (!this.ready) return;
    const run = () => {
      const o = this.ctx.createOscillator();
      o.type = type;
      const t = this.ctx.currentTime;
      o.frequency.setValueAtTime(f0, t);
      if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
      o.connect(this.envGain(vol, 0.005, dur));
      o.start(t);
      o.stop(t + dur + 0.1);
    };
    delay > 0 ? setTimeout(run, delay) : run();
  }

  noise(dur, vol, filter0, filter1) {
    if (!this.ready) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    const t = this.ctx.currentTime;
    f.frequency.setValueAtTime(filter0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(40, filter1), t + dur);
    src.connect(f);
    f.connect(this.envGain(vol, 0.005, dur));
    src.start(t);
    src.stop(t + dur + 0.1);
  }

  // ---------- Spiel-Sounds ----------

  shot(kind) {
    // Dauerfeuer nicht übersteuern lassen
    const now = performance.now();
    if (now - this.lastShot < 70) return;
    this.lastShot = now;
    if (kind === 'laser') this.tone('square', 950, 180, 0.1, 0.22);
    else if (kind === 'plasma') { this.tone('sine', 240, 55, 0.3, 0.5); this.noise(0.15, 0.15, 1200, 300); }
    else if (kind === 'rakete') this.noise(0.35, 0.3, 700, 160);
    else if (kind === 'pulse') { this.tone('sine', 500, 90, 0.28, 0.4); this.noise(0.2, 0.2, 2500, 400); }
    else this.tone('square', 600, 200, 0.1, 0.2);
  }

  explosion(big = false) {
    this.noise(big ? 0.8 : 0.32, big ? 0.9 : 0.45, big ? 1400 : 2400, 70);
    this.tone('sine', big ? 95 : 130, 40, big ? 0.5 : 0.22, 0.5);
  }

  place() { this.tone('sine', 320, 150, 0.12, 0.4); this.noise(0.05, 0.2, 3000, 900); }
  sell() { this.tone('sawtooth', 420, 130, 0.18, 0.25); }
  upgrade() { [440, 554, 659].forEach((f, i) => this.tone('square', f, f, 0.1, 0.22, i * 70)); }
  collect() { this.tone('sine', 680, 680, 0.06, 0.3); this.tone('sine', 1020, 1020, 0.09, 0.3, 60); }
  powerup() { [523, 659, 784, 1047].forEach((f, i) => this.tone('triangle', f, f, 0.13, 0.32, i * 75)); }
  ui() { this.tone('sine', 1250, 1250, 0.04, 0.15); }
  waveStart() { this.tone('sawtooth', 140, 140, 0.4, 0.22); this.tone('sawtooth', 144, 144, 0.4, 0.22); }
  bossWarn() { [0, 260, 520].forEach((d) => { this.tone('sawtooth', 115, 78, 0.24, 0.5, d); }); }
  breach() { this.tone('sawtooth', 220, 55, 0.5, 0.55); this.noise(0.4, 0.4, 1200, 90); }
  teleport() { this.tone('sine', 320, 1350, 0.16, 0.25); }
  charge() { this.tone('sine', 90, 950, 1.15, 0.3); this.tone('sawtooth', 45, 480, 1.15, 0.15); }
  orbital() { this.tone('sine', 1500, 90, 0.7, 0.55); this.noise(0.65, 0.6, 3500, 90); }
  win() { [523, 659, 784, 1047].forEach((f, i) => this.tone('triangle', f, f, 0.28, 0.4, i * 170)); }
  lose() { [392, 330, 262, 196].forEach((f, i) => this.tone('triangle', f, f, 0.32, 0.4, i * 210)); }

  // ---------- leises Ambient-Pad ----------

  startAmbient() {
    const o1 = this.ctx.createOscillator();
    const o2 = this.ctx.createOscillator();
    o1.type = 'sawtooth'; o2.type = 'sawtooth';
    o1.frequency.value = 55; o2.frequency.value = 55.6;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 150;
    // langsames Auf und Ab im Filter für "Atmen"
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 55;
    lfo.connect(lfoGain);
    lfoGain.connect(f.frequency);
    const g = this.ctx.createGain();
    g.gain.value = 0.05;
    o1.connect(f); o2.connect(f);
    f.connect(g);
    g.connect(this.master);
    o1.start(); o2.start(); lfo.start();
  }
}
