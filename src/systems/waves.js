// Wellen-Manager: arbeitet die Wellen-Datenstruktur eines Levels ab.
// Zustände: countdown (Pause vor der Welle) -> active (spawnen + kämpfen) -> nächste Welle.
// Im Endlos-Modus ("Ansturm") werden die Wellen prozedural erzeugt und enden nie.

import { FIRST_WAVE_DELAY, BREAK_BETWEEN_WAVES } from '../data/config.js';
import { makeEndlessWave } from '../data/endless.js';

export class WaveManager {
  constructor(level, callbacks) {
    this.level = level;
    this.endless = !!level.endless;
    this.cb = callbacks; // { spawnEnemy(type, lane, elite), onWaveStart(i, wave), onAllWavesCleared() }
    this.reset();
  }

  reset() {
    this.waveIndex = -1;          // -1 = noch keine Welle gestartet
    this.state = 'countdown';
    this.countdown = FIRST_WAVE_DELAY;
    this.waveTime = 0;
    this.pending = [];
    this.currentWave = null;
    this.waveSize = 0;
    this.finished = false;
  }

  get totalWaves() {
    return this.endless ? Infinity : this.level.waves.length;
  }

  // enemiesAlive: Anzahl lebender Gegner (vom Game geliefert)
  update(dt, enemiesAlive) {
    if (this.finished) return;

    if (this.state === 'countdown') {
      this.countdown -= dt;
      if (this.countdown <= 0) this.startNextWave();
    } else if (this.state === 'active') {
      this.waveTime += dt;
      while (this.pending.length > 0 && this.pending[0].t <= this.waveTime) {
        const e = this.pending.shift();
        this.cb.spawnEnemy(e.type, e.lane, e.elite);
      }
      // Welle geschafft, wenn alles gespawnt und nichts mehr lebt
      if (this.pending.length === 0 && enemiesAlive === 0) {
        if (!this.endless && this.waveIndex >= this.totalWaves - 1) {
          this.finished = true;
          this.cb.onAllWavesCleared();
        } else {
          this.state = 'countdown';
          this.countdown = BREAK_BETWEEN_WAVES;
        }
      }
    }
  }

  // Verschnaufpause überspringen (liefert die übersprungenen Sekunden)
  skipCountdown() {
    if (this.state !== 'countdown' || this.finished) return 0;
    const skipped = Math.max(0, this.countdown);
    this.countdown = 0;
    return skipped;
  }

  startNextWave() {
    this.waveIndex++;
    const wave = this.endless
      ? makeEndlessWave(this.waveIndex + 1)
      : this.level.waves[this.waveIndex];
    this.currentWave = wave;
    this.pending = [...wave.entries].sort((a, b) => a.t - b.t);
    this.waveSize = this.pending.length;
    this.waveTime = 0;
    this.state = 'active';
    this.cb.onWaveStart(this.waveIndex, wave);
  }

  // Vorschau auf die nächste Welle (für die HUD-Anzeige während des Countdowns)
  peekNextWave() {
    if (this.finished) return null;
    if (this.endless) return makeEndlessWave(this.waveIndex + 2); // grobe Vorschau
    return this.level.waves[this.waveIndex + 1] ?? null;
  }

  // Fortschritt 0..1 über das ganze Level (für die Fortschrittsleiste)
  get levelProgress() {
    if (this.endless) return 0;
    const total = this.totalWaves;
    const inWave = this.state === 'active' && this.waveSize > 0
      ? 1 - this.pending.length / this.waveSize
      : 0;
    return Math.min(1, (this.waveIndex + inWave) / total);
  }
}
