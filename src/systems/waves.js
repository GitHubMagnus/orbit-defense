// Wellen-Manager: arbeitet die Wellen-Datenstruktur eines Levels ab.
// Zustände: countdown (Pause vor der Welle) -> active (spawnen + kämpfen) -> nächste Welle.

import { FIRST_WAVE_DELAY, BREAK_BETWEEN_WAVES } from '../data/config.js';

export class WaveManager {
  constructor(level, callbacks) {
    this.level = level;
    this.cb = callbacks; // { spawnEnemy(type, lane), onWaveStart(i, wave), onAllWavesCleared() }
    this.reset();
  }

  reset() {
    this.waveIndex = -1;          // -1 = noch keine Welle gestartet
    this.state = 'countdown';
    this.countdown = FIRST_WAVE_DELAY;
    this.waveTime = 0;
    this.pending = [];
    this.finished = false;
  }

  get totalWaves() {
    return this.level.waves.length;
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
        this.cb.spawnEnemy(e.type, e.lane);
      }
      // Welle geschafft, wenn alles gespawnt und nichts mehr lebt
      if (this.pending.length === 0 && enemiesAlive === 0) {
        if (this.waveIndex >= this.totalWaves - 1) {
          this.finished = true;
          this.cb.onAllWavesCleared();
        } else {
          this.state = 'countdown';
          this.countdown = BREAK_BETWEEN_WAVES;
        }
      }
    }
  }

  startNextWave() {
    this.waveIndex++;
    const wave = this.level.waves[this.waveIndex];
    this.pending = [...wave.entries].sort((a, b) => a.t - b.t);
    this.waveTime = 0;
    this.state = 'active';
    this.cb.onWaveStart(this.waveIndex, wave);
  }
}
