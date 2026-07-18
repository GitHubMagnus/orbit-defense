// Zentrale Spielsteuerung: Game-State, Game-Loop, Input, Orchestrierung aller Systeme.

import * as THREE from 'three';
import { createWorld } from './core/scene.js';
import { Defender } from './entities/Defender.js';
import { Enemy } from './entities/Enemy.js';
import { Projectile } from './entities/Projectile.js';
import { ParticleSystem } from './systems/particles.js';
import { CrystalSystem } from './systems/crystals.js';
import { PowerUpSystem, POWERUP_TYPES } from './systems/powerups.js';
import { WaveManager } from './systems/waves.js';
import { HUD } from './ui/hud.js';
import { DEFENDER_TYPES, DEFENDER_ORDER } from './data/defenders.js';
import { ENEMY_TYPES } from './data/enemies.js';
import { LEVELS } from './data/levels.js';
import {
  loadProgress, saveProgress, resetProgress, unlockAfterWin, starsForIntegrity,
  recordStars, recordEndlessBest, SKILLS,
} from './systems/progress.js';
import { Sound } from './systems/sound.js';
import { ENDLESS_LEVEL } from './data/endless.js';
import { getTexture } from './entities/meshFactory.js';
import {
  LANES, COLS, CELL_X, laneZ, colX, GRID_LEFT_X, SPAWN_X,
  START_ENERGY, START_INTEGRITY, LANE_SPACING,
} from './data/config.js';

export class Game {
  constructor(container) {
    this.world = createWorld(container);
    this.particles = new ParticleSystem(this.world.scene);
    this.crystals = new CrystalSystem(this.world.scene);
    this.powerups = new PowerUpSystem(this.world.scene);
    this.progress = loadProgress();
    this.sound = new Sound();
    this.hud = new HUD({
      onSelectUnit: (t) => {
        this.selectedType = t;
        if (!t) {
          // Auswahl aufgehoben: alle Vorschau-Marker ausblenden
          if (this.rangeCircle) this.rangeCircle.visible = false;
          if (this.rangeStripe) this.rangeStripe.visible = false;
          if (this.highlight) this.highlight.visible = false;
        }
      },
      onStartLevel: (i) => this.startLevel(i),
      onStartEndless: () => this.startLevel(-1),
      onRestart: () => this.startLevel(this.endless ? -1 : this.currentLevel),
      onLevelSelect: () => this.returnToMenu(),
      onResetProgress: () => this.resetProgress(),
      onDragStart: (t, ev) => this.startDrag(t, ev),
      onPause: () => this.togglePause(),
      onSpeed: () => this.toggleSpeed(),
      onMute: () => this.sound.toggleMuted(),
      onSkipWave: () => this.skipWave(),
      onOrbital: () => this.armOrbital(),
      sound: this.sound,
    });
    this.hud.refreshMeta(this.progress, LEVELS);

    // Tempo/Pause + Orbitalschlag
    this.timeScale = 1;
    this.paused = false;
    this.orbitalCooldown = 0;
    this.pendingStrikes = [];
    this.shakeT = 0;
    this.camBase = this.world.camera.position.clone();

    // AudioContext braucht eine Nutzer-Geste
    window.addEventListener('pointerdown', () => this.sound.ensure(), { once: false });

    // Reichweiten-Vorschau (Kreis für Radial-Türme, Streifen für Lane-Schützen)
    this.rangeCircle = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({
        map: getTexture('range-ring', 256, 256, (ctx) => {
          ctx.strokeStyle = 'rgba(120,240,255,0.9)';
          ctx.lineWidth = 6;
          ctx.setLineDash([16, 10]);
          ctx.beginPath(); ctx.arc(128, 128, 122, 0, Math.PI * 2); ctx.stroke();
          const g = ctx.createRadialGradient(128, 128, 40, 128, 128, 122);
          g.addColorStop(0, 'rgba(120,240,255,0.02)');
          g.addColorStop(1, 'rgba(120,240,255,0.14)');
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(128, 128, 122, 0, Math.PI * 2); ctx.fill();
        }),
        transparent: true, depthWrite: false,
      })
    );
    this.rangeCircle.rotation.x = -Math.PI / 2;
    this.rangeCircle.position.y = 0.08;
    this.rangeCircle.renderOrder = -1;
    this.rangeCircle.visible = false;
    this.world.scene.add(this.rangeCircle);

    this.rangeStripe = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({
        color: 0x78f0ff, transparent: true, opacity: 0.12, depthWrite: false,
      })
    );
    this.rangeStripe.rotation.x = -Math.PI / 2;
    this.rangeStripe.position.y = 0.08;
    this.rangeStripe.renderOrder = -1;
    this.rangeStripe.visible = false;
    this.world.scene.add(this.rangeStripe);

    this.phase = 'menu'; // menu | playing | gameover | win
    this.currentLevel = 0;
    this.selectedType = null;

    this.defenders = [];
    this.enemies = [];
    this.projectiles = [];
    this.grid = null;      // grid[lane][col] -> Defender | null
    this.cooldowns = {};   // typeId -> verbleibende Sekunden

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.buildHoverHighlight();
    this.bindInput();

    this.clock = new THREE.Clock();
    this.elapsed = 0;
    this.hud.showScreen('start');
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  // ---------- Level-Lebenszyklus ----------

  // levelIndex -1 = Endlos-Modus "Ansturm"
  startLevel(levelIndex) {
    this.endless = levelIndex === -1;
    if (this.endless && this.progress.levelsUnlocked < 2) return; // erst nach Sieg in Level 1
    if (!this.endless && levelIndex + 1 > this.progress.levelsUnlocked) return; // noch gesperrt
    const level = this.endless ? ENDLESS_LEVEL : LEVELS[levelIndex];
    this.currentLevel = levelIndex;
    this.clearEntities();
    this.crystals.reset();
    this.powerups.reset();

    // Skill "Not-Reserve": +50 Start-Energie
    this.energy = START_ENERGY + (this.progress.skills.includes('notreserve') ? 50 : 0);
    this.integrity = START_INTEGRITY;
    this.grid = Array.from({ length: LANES }, () => Array(COLS).fill(null));
    this.cooldowns = {};
    this.buffs = { overchargeUntil: 0 };

    // Spezialfelder: boostCells (schnellere Feuerrate/Produktion) & blockedCells (unbebaubar)
    this.boostCells = new Set();
    this.blockedCells = new Set();
    for (const c of level.specialCells ?? []) {
      const key = `${c.lane},${c.col}`;
      if (c.type === 'boost') this.boostCells.add(key);
      else if (c.type === 'blocked') this.blockedCells.add(key);
    }
    this.world.setSpecialCells(level.specialCells ?? []);
    this.selectedType = null;
    this.hud.select(null);
    this.hud.hideBuildMenu();

    // Statistik für den Level-Abschluss
    this.stats = { kills: 0, energyCollected: 0, built: 0, damageByTower: {} };
    this.paused = false;
    this.timeScale = 1;
    this.orbitalCooldown = 0;
    this.pendingStrikes = [];
    this.hud.setPaused(false);
    this.hud.setSpeed(1);

    // Level-Theme (Endlos: Abyss-Look)
    this.world.applyTheme(this.endless ? 2 : levelIndex);

    this.waves = new WaveManager(level, {
      spawnEnemy: (type, lane, elite) => this.spawnEnemy(type, lane, elite),
      onWaveStart: (i, wave) => {
        // Zinsen auf gespartes Guthaben (8 %, max +40) — belohnt vorausschauendes Sparen
        if (i >= 1 && this.energy > 0) {
          const interest = Math.min(40, Math.floor(this.energy * 0.08));
          if (interest > 0) {
            this.energy += interest;
            this.hud.setEnergy(this.energy, true);
            this.hud.floatCenter?.(`+${interest} Zinsen`);
          }
        }
        this.hud.showBanner(`WELLE ${i + 1}`, wave.label ?? '', !!wave.danger);
        this.hud.hideWavePreview();
        this.sound.waveStart();
      },
      onAllWavesCleared: () => this.win(),
    });
    this.hud.buildWaveBar(this.endless ? null : level);
    this.hud.hideBossBar();
    this.lastPreviewWave = -2;

    this.phase = 'playing';
    this.hud.showScreen('game');
    this.hud.setEnergy(this.energy);
    this.hud.setIntegrity(this.integrity);
    this.hud.showBanner(
      this.endless ? 'ANSTURM-MODUS' : 'SYSTEME ONLINE',
      this.endless ? `Rekord: Welle ${this.progress.endlessBest} — wie weit kommst du?` : 'Baue deine Verteidigung auf!'
    );
  }

  // sauber ins Hauptmenü zurück (Pause aufheben, laufendes Level verwerfen)
  returnToMenu() {
    this.paused = false;
    this.hud.setPaused(false);
    this.phase = 'menu';
    this.clearEntities();
    this.crystals.reset();
    this.powerups.reset();
    this.hud.hideBuildMenu();
    this.hud.select(null);
    this.hud.showScreen('start');
  }

  togglePause() {
    if (this.phase !== 'playing') return;
    this.paused = !this.paused;
    this.hud.setPaused(this.paused);
    if (this.paused) {
      // in der Pause ist auch das Bauen eingefroren
      this.hud.hideBuildMenu();
      this.hud.hideTooltip();
      this.highlight.visible = false;
      this.rangeCircle.visible = false;
      this.rangeStripe.visible = false;
    }
    this.sound.ui();
  }

  toggleSpeed() {
    this.timeScale = this.timeScale === 1 ? 2 : 1;
    this.hud.setSpeed(this.timeScale);
    this.sound.ui();
  }

  // Verschnaufpause überspringen: 2 Energie pro übersprungener Sekunde
  skipWave() {
    if (this.phase !== 'playing' || this.paused) return;
    const skipped = this.waves.skipCountdown();
    if (skipped > 0.5) {
      const bonus = Math.ceil(skipped * 2);
      this.energy += bonus;
      this.hud.setEnergy(this.energy, true);
      this.hud.showBanner('WELLE VORGEZOGEN', `+${bonus} Energie-Bonus`);
      this.sound.powerup();
    }
  }

  // Orbitalschlag: Ziel wählen, kurzer Countdown, dann Flächenschaden
  armOrbital() {
    if (this.phase !== 'playing' || this.paused) return;
    if (this.orbitalCooldown > 0 || this.energy < 100) return;
    this.hud.select(this.selectedType === 'orbital' ? null : 'orbital');
    this.sound.ui();
  }

  fireOrbital(cell) {
    this.energy -= 100;
    this.orbitalCooldown = 45;
    this.hud.setEnergy(this.energy);
    const pos = new THREE.Vector3(colX(cell.col), 0, laneZ(cell.lane));
    // roter Laser: erst 1,2 s aufladen (Zielstrahl + einstürzende Funken), dann Abschuss
    this.pendingStrikes.push({ pos, t: 1.2, chargeTick: 0 });
    this.particles.preBeam(pos, 1.2);
    this.particles.shockwave(pos.clone().add(new THREE.Vector3(0, 0.5, 0)), 0xff4050, 3);
    this.sound.charge();
    this.hud.select(null);
  }

  clearEntities() {
    for (const d of this.defenders) this.world.scene.remove(d.group);
    for (const e of this.enemies) this.world.scene.remove(e.group);
    for (const p of this.projectiles) p.removeFrom(this.world.scene);
    this.defenders = [];
    this.enemies = [];
    this.projectiles = [];
  }

  gameOver() {
    this.phase = 'gameover';
    this.sound.lose();
    let endlessLine = '';
    if (this.endless) {
      const wave = this.waves.waveIndex + 1;
      const isRecord = recordEndlessBest(this.progress, wave);
      endlessLine = isRecord
        ? `🏆 NEUER REKORD: Welle ${wave}!`
        : `Erreicht: Welle ${wave} (Rekord: ${this.progress.endlessBest})`;
      this.hud.refreshMeta(this.progress, LEVELS);
    }
    this.hud.setGameoverStats(this.waves.waveIndex + 1, this.waves.totalWaves, endlessLine);
    this.hud.setEndStats('gameover', this.buildStatsSummary());
    this.hud.showScreen('gameover');
  }

  // Level-Statistik für die End-Screens
  buildStatsSummary() {
    const entries = Object.entries(this.stats.damageByTower);
    let mvp = null;
    if (entries.length > 0) {
      entries.sort((a, b) => b[1] - a[1]);
      const [id, dmg] = entries[0];
      const name = id === 'orbital' ? 'Orbitalschlag' : (DEFENDER_TYPES[id]?.name ?? id);
      mvp = `${name} (${Math.round(dmg)} Schaden)`;
    }
    return {
      kills: this.stats.kills,
      energy: this.stats.energyCollected,
      built: this.stats.built,
      mvp,
    };
  }

  win() {
    // Feuerwerks-Animation, dann Sieg-Screen mit Freischaltungen
    this.phase = 'winAnim';
    this.winAnimT = 0;
    this.fireworkTimer = 0;
    this.sound.win();
    this.hud.showBanner('SEKTOR GESICHERT!', LEVELS[this.currentLevel].name);
    this.pendingUnlocks = unlockAfterWin(this.progress, this.currentLevel, LEVELS.length);
    this.winStars = starsForIntegrity(this.integrity);
    recordStars(this.progress, this.currentLevel, this.winStars);
    this.hud.refreshMeta(this.progress, LEVELS);
  }

  updateWinAnim(dt) {
    this.winAnimT += dt;
    this.fireworkTimer -= dt;
    if (this.fireworkTimer <= 0) {
      this.fireworkTimer = 0.28;
      // Feuerwerk im sichtbaren Bereich über dem Spielfeld
      const pos = new THREE.Vector3(
        -18 + Math.random() * 36,
        2.5 + Math.random() * 4,
        -10 + Math.random() * 12
      );
      this.particles.firework(pos);
    }
    if (this.winAnimT >= 3.4) {
      this.phase = 'win';
      this.hud.showWinScreen(this.pendingUnlocks, LEVELS, this.currentLevel, this.winStars);
      this.hud.setEndStats('win', this.buildStatsSummary());
    }
  }

  // ---------- Spawning ----------

  spawnEnemy(type, lane, elite = false) {
    const enemy = new Enemy(ENEMY_TYPES[type], lane, { elite });
    this.world.scene.add(enemy.group);
    this.enemies.push(enemy);
    // Boss-Auftritt: Warnung mit Shake, Vignette und Klaxon
    if (enemy.data.isBoss) {
      this.shakeT = 0.5;
      this.hud.flashVignette();
      this.sound.bossWarn();
      this.particles.shockwave(enemy.position.clone().add(new THREE.Vector3(0, 2, 0)), 0xff4dd2, 6);
    }
  }

  spawnMinion(type, lane, x) {
    const enemy = new Enemy(ENEMY_TYPES[type], lane);
    enemy.position.x = Math.min(x, SPAWN_X);
    this.world.scene.add(enemy.group);
    this.enemies.push(enemy);
    this.particles.burstAlien(enemy.position.clone().add(new THREE.Vector3(0, 1.3, 0)), 6);
  }

  spawnProjectile(kind, from, target, damage, opts = {}) {
    const p = new Projectile(kind, from, target, damage, opts);
    p.addTo(this.world.scene);
    this.projectiles.push(p);
  }

  spawnEnemyBolt(from, target, damage) {
    this.spawnProjectile('bolt', from, target, damage);
  }

  // ---------- Input & Platzierung ----------

  buildHoverHighlight() {
    this.highlight = new THREE.Mesh(
      new THREE.PlaneGeometry(CELL_X - 0.5, 3.9),
      new THREE.MeshBasicMaterial({
        color: 0x4DD0E1, transparent: true, opacity: 0.25,
        blending: THREE.AdditiveBlending, depthWrite: false,
      })
    );
    this.highlight.rotation.x = -Math.PI / 2;
    this.highlight.position.y = 0.05;
    this.highlight.visible = false;
    this.world.scene.add(this.highlight);
  }

  bindInput() {
    const canvas = this.world.renderer.domElement;
    canvas.addEventListener('pointermove', (ev) => this.onPointerMove(ev));
    canvas.addEventListener('pointerdown', (ev) => {
      if (ev.button === 0) this.onLeftClick(ev);
    });
    canvas.addEventListener('contextmenu', (ev) => {
      ev.preventDefault();
      this.onRightClick(ev);
    });
    window.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape') {
        this.hud.select(null);
        this.hud.hideBuildMenu();
        return;
      }
      // Cheat-Codes: einfach blind eintippen (überall, auch im Start-Screen)
      if (ev.key.length === 1 && /[a-z]/i.test(ev.key)) {
        this.cheatBuffer = ((this.cheatBuffer ?? '') + ev.key.toLowerCase()).slice(-24);
        if (this.checkCheats()) return;
        // Hotkeys stummschalten, solange die Eingabe wie ein angefangener Cheat aussieht
        if (this.cheatPending()) return;
      }
      if (this.phase !== 'playing') return;
      // Hotkeys: 1-8 Gebäude, R Recycler, Q Orbitalschlag, Leertaste Welle, P Pause, F Tempo
      const k = ev.key.toLowerCase();
      if (k >= '1' && k <= '8') {
        const typeId = DEFENDER_ORDER[Number(k) - 1];
        if (typeId && this.progress.towers.includes(typeId)) {
          this.hud.select(this.selectedType === typeId ? null : typeId);
          this.sound.ui();
        }
      } else if (k === 'r') {
        this.hud.select(this.selectedType === 'recycler' ? null : 'recycler');
        this.sound.ui();
      } else if (k === 'q') {
        this.armOrbital();
      } else if (k === ' ') {
        ev.preventDefault();
        this.skipWave();
      } else if (k === 'p') {
        this.togglePause();
      } else if (k === 'f') {
        this.toggleSpeed();
      }
    });
    // Drag & Drop aus der Einheiten-Leiste
    window.addEventListener('pointermove', (ev) => {
      if (!this.drag) return;
      const dx = ev.clientX - this.drag.startX;
      const dy = ev.clientY - this.drag.startY;
      if (dx * dx + dy * dy > 64) this.drag.moved = true;
      this.hud.moveDragGhost(ev.clientX, ev.clientY);
      if (this.drag.moved) this.onPointerMove(ev); // Zell-Highlight folgt
    });
    window.addEventListener('pointerup', (ev) => {
      if (!this.drag) return;
      const drag = this.drag;
      this.drag = null;
      this.hud.hideDragGhost();
      if (!drag.moved) {
        // kurzer Klick: Auswahl bleibt bestehen (bzw. wurde getoggelt)
        return;
      }
      // echter Drag: über dem Spielfeld loslassen = platzieren/anwenden
      if (ev.target === this.world.renderer.domElement) {
        this.handleFieldAction(ev);
      }
      this.hud.select(null);
      this.highlight.visible = false;
    });
  }

  // ---------- Cheat-Codes (zum Ausprobieren ohne Grind) ----------

  static CHEATS = ['unlockall', 'unlimitedpower', 'resetall'];

  // Fortschritt auf Werkseinstellung zurücksetzen (löscht den Spielstand)
  resetProgress() {
    this.progress = resetProgress();
    this.hud.refreshMeta(this.progress, LEVELS);
  }

  // sieht der Puffer wie ein angefangener Cheat aus? (mind. 2 passende Zeichen)
  cheatPending() {
    const buf = this.cheatBuffer ?? '';
    for (const code of Game.CHEATS) {
      const max = Math.min(buf.length, code.length - 1);
      for (let len = max; len >= 2; len--) {
        if (code.startsWith(buf.slice(-len))) return true;
      }
    }
    return false;
  }

  checkCheats() {
    const buf = this.cheatBuffer ?? '';
    if (buf.endsWith('unlockall')) {
      this.cheatBuffer = '';
      // alle Level, Gebäude und Skills sofort freischalten
      this.progress.levelsUnlocked = LEVELS.length;
      this.progress.towers = [...DEFENDER_ORDER];
      this.progress.skills = Object.keys(SKILLS);
      saveProgress(this.progress);
      this.hud.refreshMeta(this.progress, LEVELS);
      if (this.phase === 'playing') {
        this.hud.showBanner('CHEAT AKTIVIERT', 'Alle Level, Gebäude und Skills freigeschaltet!');
      }
      this.sound.powerup();
      return true;
    }
    if (buf.endsWith('unlimitedpower')) {
      this.cheatBuffer = '';
      if (this.phase === 'playing') {
        this.energy += 10000;
        this.hud.setEnergy(this.energy, true);
        this.hud.showBanner('CHEAT AKTIVIERT', '+10.000 Energie!');
        this.sound.powerup();
      }
      return true;
    }
    if (buf.endsWith('resetall')) {
      this.cheatBuffer = '';
      this.resetProgress();
      if (this.phase === 'playing') {
        this.hud.showBanner('FORTSCHRITT ZURÜCKGESETZT', 'Alles wieder gesperrt.');
      }
      this.sound.ui();
      return true;
    }
    return false;
  }

  // von der HUD-Karte aus gestartet (pointerdown auf einer Einheiten-Karte)
  startDrag(typeId, ev) {
    if (this.phase !== 'playing' || this.paused) return;
    // Klick auf bereits gewählte Karte: abwählen (Toggle wie bisher)
    if (this.selectedType === typeId) {
      this.hud.select(null);
      return;
    }
    this.hud.select(typeId);
    this.drag = { type: typeId, startX: ev.clientX, startY: ev.clientY, moved: false };
    this.hud.showDragGhost(typeId, ev.clientX, ev.clientY);
  }

  updateRaycaster(ev) {
    this.pointer.x = (ev.clientX / window.innerWidth) * 2 - 1;
    this.pointer.y = -(ev.clientY / window.innerHeight) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.world.camera);
  }

  // Zelle unter dem Mauszeiger (oder null)
  pickCell(ev) {
    this.updateRaycaster(ev);
    const hits = this.raycaster.intersectObject(this.world.pickPlane);
    if (hits.length === 0) return null;
    const p = hits[0].point;
    const col = Math.round((p.x - GRID_LEFT_X) / CELL_X);
    const lane = Math.round(p.z / LANE_SPACING + (LANES - 1) / 2);
    if (col < 0 || col >= COLS || lane < 0 || lane >= LANES) return null;
    // nur akzeptieren, wenn wirklich in Korridornähe geklickt wurde
    if (Math.abs(p.z - laneZ(lane)) > 2.2) return null;
    return { lane, col };
  }

  onPointerMove(ev) {
    if (this.phase !== 'playing') return;
    const cell = this.pickCell(ev);
    this.updateRangePreview(cell);
    if (cell && this.selectedType === 'orbital') {
      this.highlight.visible = true;
      this.highlight.position.x = colX(cell.col);
      this.highlight.position.z = laneZ(cell.lane);
      this.highlight.material.color.set(0xFFD23F);
    } else if (cell && this.selectedType === 'recycler') {
      // Recycler: nur belegte Zellen markieren
      const defender = this.grid[cell.lane][cell.col];
      this.highlight.visible = !!defender;
      this.highlight.position.x = colX(cell.col);
      this.highlight.position.z = laneZ(cell.lane);
      this.highlight.material.color.set(0xFF8A5C);
    } else if (cell && this.selectedType) {
      this.highlight.visible = true;
      this.highlight.position.x = colX(cell.col);
      this.highlight.position.z = laneZ(cell.lane);
      const blocked = this.blockedCells?.has(`${cell.lane},${cell.col}`);
      const free = !this.grid[cell.lane][cell.col] && !blocked;
      const affordable = this.energy >= DEFENDER_TYPES[this.selectedType].cost;
      const ready = (this.cooldowns[this.selectedType] ?? 0) <= 0;
      this.highlight.material.color.set(free && affordable && ready ? 0x4DD0E1 : 0xFF5252);
    } else {
      this.highlight.visible = false;
    }
  }

  // Reichweiten-Vorschau: Kreis für Radial-Wirkung, Lane-Streifen für Schützen
  updateRangePreview(cell) {
    this.rangeCircle.visible = false;
    this.rangeStripe.visible = false;
    if (!cell) return;
    const data = this.selectedType ? DEFENDER_TYPES[this.selectedType] : null;
    const occupant = this.grid[cell.lane][cell.col];
    // beim Platzieren: Reichweite des gewählten Typs; sonst des Gebäudes unterm Cursor
    const src = data ?? occupant?.data;
    const range = occupant && !data ? occupant.range : src?.range;
    if (!src || !range) return;
    const x = colX(cell.col), z = laneZ(cell.lane);
    if (src.behavior === 'shooter') {
      this.rangeStripe.visible = true;
      this.rangeStripe.scale.set(range, 3.9, 1);
      this.rangeStripe.position.set(x + range / 2, 0.08, z);
    } else if (src.behavior === 'pulse' || src.behavior === 'slower' || src.behavior === 'healer') {
      this.rangeCircle.visible = true;
      this.rangeCircle.scale.set(range * 2, range * 2, 1);
      this.rangeCircle.position.set(x, 0.08, z);
    }
  }

  // Hover-Kurzinfo über platzierten Gebäuden
  onLeftClick(ev) {
    if (this.phase !== 'playing' || this.paused) return;
    this.updateRaycaster(ev);
    this.hud.hideBuildMenu();

    // 1) Power-up einsammeln hat höchsten Vorrang
    const powerup = this.powerups.tryCollect(this.raycaster);
    if (powerup) {
      this.applyPowerup(powerup.type, powerup.position);
      this.sound.powerup();
      return;
    }

    // 2) Energie-Blitz einsammeln (Skill "Ladekerne": +10 extra)
    const collected = this.crystals.tryCollect(this.raycaster);
    if (collected) {
      const value = collected.value + (this.progress.skills.includes('ladekerne') ? 10 : 0);
      this.energy += value;
      this.stats.energyCollected += value;
      this.hud.setEnergy(this.energy, true);
      this.particles.burstCrystal(collected.position);
      this.hud.floatText(ev.clientX, ev.clientY, `+${value}`);
      this.sound.collect();
      return;
    }

    this.handleFieldAction(ev);
  }

  // Recycler / Orbitalschlag / Ausbau-Menü / Platzierung — Klick UND Drag & Drop
  handleFieldAction(ev) {
    const cell = this.pickCell(ev);
    if (!cell) return;
    const occupant = this.grid[cell.lane][cell.col];

    // Orbitalschlag-Zielmodus
    if (this.selectedType === 'orbital') {
      this.fireOrbital(cell);
      return;
    }

    // Recycler-Werkzeug: Gebäude abreißen
    if (this.selectedType === 'recycler') {
      if (occupant) this.sellDefender(occupant, ev.clientX, ev.clientY);
      return;
    }

    // Klick/Drop auf bestehendes Gebäude: Ausbau-Menü öffnen
    if (occupant) {
      this.openBuildMenu(occupant, ev.clientX, ev.clientY);
      return;
    }

    // Trümmerfeld: nicht bebaubar
    if (this.blockedCells.has(`${cell.lane},${cell.col}`)) {
      this.hud.showBanner('TRÜMMERFELD', 'Dieses Feld ist blockiert.');
      return;
    }

    // Einheit platzieren
    if (!this.selectedType) return;
    const data = DEFENDER_TYPES[this.selectedType];
    if (this.energy < data.cost) return;
    if ((this.cooldowns[this.selectedType] ?? 0) > 0) return;

    const defender = new Defender(data, cell.lane, cell.col);
    // Energie-Knoten: +30 % Feuerrate / Produktion / Pulsrate
    if (this.boostCells.has(`${cell.lane},${cell.col}`)) defender.boosted = true;
    this.world.scene.add(defender.group);
    this.defenders.push(defender);
    this.grid[cell.lane][cell.col] = defender;
    this.energy -= data.cost;
    this.stats.built++;
    // Skill "Schnell-Kühlung": Abklingzeiten -25 %
    const cdFactor = this.progress.skills.includes('schnellkuehlung') ? 0.75 : 1;
    this.cooldowns[data.id] = data.cooldown * cdFactor;
    this.hud.setEnergy(this.energy);
    this.particles.burstImpact(defender.position.clone().add(new THREE.Vector3(0, 1, 0)));
    this.sound.place();
    // nach dem Platzieren abwählen, damit der nächste Klick (z. B. Energie sammeln)
    // nicht versehentlich ein weiteres Gebäude setzt
    this.hud.select(null);
    this.highlight.visible = false;
  }

  sellDefender(defender, screenX, screenY) {
    const refund = defender.refundValue;
    this.energy += refund;
    this.hud.setEnergy(this.energy, true);
    this.hud.floatText(screenX, screenY, `+${refund}`);
    this.particles.burstImpact(defender.position.clone().add(new THREE.Vector3(0, 1.5, 0)), 0xff8a5c);
    this.removeDefender(defender);
    this.sound.sell();
  }

  openBuildMenu(defender, x, y) {
    this.hud.showBuildMenu(defender, x, y, {
      energy: this.energy,
      onUpgrade: (pathKey) => {
        if (this.paused || defender.dead) return;
        if (!defender.canUpgrade || this.energy < defender.upgradeCost) return;
        this.energy -= defender.upgradeCost;
        defender.upgrade(pathKey);
        this.hud.setEnergy(this.energy, true);
        this.particles.burstImpact(defender.position.clone().add(new THREE.Vector3(0, 2.4, 0)), 0xffd23f);
        this.particles.shockwave(defender.position.clone().add(new THREE.Vector3(0, 1, 0)), 0xffd23f, 3);
        this.sound.upgrade();
        // Menü mit frischen Werten neu zeichnen
        this.openBuildMenu(defender, x, y);
      },
      onSell: () => {
        if (this.paused || defender.dead) return;
        this.sellDefender(defender, x, y);
        this.hud.hideBuildMenu();
      },
    });
  }

  applyPowerup(type, position) {
    const info = POWERUP_TYPES[type];
    this.hud.showBanner(info.name, info.description);
    if (type === 'ueberladung') {
      this.buffs.overchargeUntil = this.elapsed + 10;
      this.particles.burstCrystal(position);
      this.particles.shockwave(position, 0xffd23f, 6);
    } else if (type === 'emp') {
      this.particles.shockwave(position, 0xc26bd6, 12);
      this.particles.flash(position, 0xc26bd6);
      for (const e of this.enemies) {
        e.takeDamage(60, 'emp');
        e.empUntil = this.elapsed + 3;
        if (!e.dead) {
          this.particles.burstImpact(e.position.clone().add(new THREE.Vector3(0, 1.4, 0)), 0xc26bd6);
        }
      }
    } else if (type === 'reparatur') {
      this.particles.shockwave(position, 0x3ecf6a, 6);
      for (const d of this.defenders) {
        if (d.heal(d.maxHp * 0.5) > 0) {
          this.particles.burstImpact(d.position.clone().add(new THREE.Vector3(0, 2.2, 0)), 0x3ecf6a);
        }
      }
    } else if (type === 'magnet') {
      // alle Energie-Blitze auf einen Schlag einsammeln
      this.particles.shockwave(position, 0x40e0ff, 10);
      const bonusPerCrystal = this.progress.skills.includes('ladekerne') ? 10 : 0;
      const collected = this.crystals.collectAll();
      let total = 0;
      for (const c of collected) {
        const value = c.value + bonusPerCrystal;
        total += value;
        this.particles.burstCrystal(c.position);
      }
      if (total > 0) {
        this.energy += total;
        this.stats.energyCollected += total;
        this.hud.setEnergy(this.energy, true);
        this.hud.floatCenter(`+${total} eingesammelt`);
      }
    }
  }

  // Rechtsklick: Info-Tooltip; zweiter Rechtsklick auf dieselbe Einheit verkauft
  onRightClick(ev) {
    if (this.phase !== 'playing' || this.paused) return;
    const cell = this.pickCell(ev);
    if (!cell) { this.hud.hideTooltip(); this.sellCandidate = null; return; }
    const defender = this.grid[cell.lane][cell.col];
    if (!defender) { this.hud.hideTooltip(); this.sellCandidate = null; return; }

    if (this.sellCandidate === defender) {
      // verkaufen mit Teilrückerstattung
      this.sellDefender(defender, ev.clientX, ev.clientY);
      this.hud.hideTooltip();
      this.sellCandidate = null;
    } else {
      this.sellCandidate = defender;
      this.hud.showPlacedTooltip(defender, ev.clientX, ev.clientY);
    }
  }

  removeDefender(defender) {
    this.world.scene.remove(defender.group);
    this.grid[defender.lane][defender.col] = null;
    const i = this.defenders.indexOf(defender);
    if (i >= 0) this.defenders.splice(i, 1);
  }

  // ---------- Game-Loop ----------

  loop() {
    requestAnimationFrame(this.loop);
    const rawDt = Math.min(this.clock.getDelta(), 0.05);
    // Pause friert das Spiel ein, ×2-Tempo beschleunigt es
    const dt = this.paused ? 0 : rawDt * this.timeScale;
    this.elapsed += dt;
    const time = this.elapsed;

    this.world.updateEnvironment(rawDt, time); // Hintergrund lebt immer weiter
    this.particles.update(dt);

    if (this.phase === 'playing') {
      this.update(dt, time);
    } else if (this.phase === 'winAnim') {
      this.updateWinAnim(rawDt);
    }

    // Screen-Shake (Durchbruch, Boss-Auftritt)
    if (this.shakeT > 0) {
      this.shakeT = Math.max(0, this.shakeT - rawDt);
      const k = this.shakeT * 0.5;
      this.world.camera.position.set(
        this.camBase.x + (Math.random() - 0.5) * k,
        this.camBase.y + (Math.random() - 0.5) * k * 0.6,
        this.camBase.z + (Math.random() - 0.5) * k
      );
    } else if (!this.world.camera.position.equals(this.camBase)) {
      this.world.camera.position.copy(this.camBase);
    }

    this.world.composer.render();
  }

  update(dt, time) {
    const ctx = {
      enemies: this.enemies,
      defenders: this.defenders,
      particles: this.particles,
      sfx: this.sound,
      overcharged: time < this.buffs.overchargeUntil,
      recordDamage: (id, dmg) => {
        this.stats.damageByTower[id] = (this.stats.damageByTower[id] ?? 0) + dmg;
      },
      spawnProjectile: (k, f, t, d, o) => this.spawnProjectile(k, f, t, d, o),
      spawnEnemyBolt: (f, t, d) => this.spawnEnemyBolt(f, t, d),
      spawnCrystalAt: (pos) => this.crystals.spawnAt(pos),
      spawnMinion: (type, lane, x) => this.spawnMinion(type, lane, x),
    };

    // Orbitalschlag: Cooldown + Aufladung + verzögerte Einschläge
    this.orbitalCooldown = Math.max(0, this.orbitalCooldown - dt);
    for (let i = this.pendingStrikes.length - 1; i >= 0; i--) {
      const s = this.pendingStrikes[i];
      s.t -= dt;
      // während der Aufladung stürzen rote Funken ins Ziel
      s.chargeTick -= dt;
      if (s.t > 0 && s.chargeTick <= 0) {
        s.chargeTick = 0.16;
        this.particles.chargeSpark(s.pos.clone().add(new THREE.Vector3(0, 0.8, 0)));
      }
      if (s.t <= 0) {
        this.pendingStrikes.splice(i, 1);
        this.particles.beam(s.pos.clone().add(new THREE.Vector3(0, 0.3, 0)), 0xff4050);
        this.sound.orbital();
        this.shakeT = Math.max(this.shakeT, 0.35);
        for (const e of this.enemies) {
          if (!e.dead && e.position.distanceTo(s.pos) <= 3.2) {
            e.takeDamage(150, 'orbital');
            this.stats.damageByTower.orbital = (this.stats.damageByTower.orbital ?? 0) + 150;
          }
        }
      }
    }

    // Cooldowns
    for (const key of Object.keys(this.cooldowns)) {
      this.cooldowns[key] = Math.max(0, this.cooldowns[key] - dt);
    }

    // Energie-Blitze & Power-ups
    this.crystals.update(dt, time);
    this.powerups.update(dt, time);

    // Verteidiger (Traktorstrahlen zuerst, damit slowFactor vor der Bewegung gesetzt ist)
    for (const d of this.defenders) {
      if (d.data.behavior === 'slower') d.update(dt, time, ctx);
    }
    for (const d of this.defenders) {
      if (d.data.behavior !== 'slower') d.update(dt, time, ctx);
    }

    // Gegner
    for (const e of this.enemies) {
      e.update(dt, time, ctx);
    }

    // Aegis-Schutzfeld: reihenfolge-unabhängig in eigenem Durchlauf setzen
    for (const e of this.enemies) e.protected = false;
    for (const a of this.enemies) {
      if (a.dead || !a.data.aegis) continue;
      for (const e of this.enemies) {
        if (e === a || e.dead) continue;
        if (e.position.distanceTo(a.position) <= a.data.aegis.radius) e.protected = true;
      }
    }

    // Projektile
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      const hit = p.update(dt);
      if (hit && !hit.dead) {
        const impactPos = p.mesh.position.clone();
        const shieldBefore = hit.shield;
        const shieldOnly = hit.takeDamage(p.damage, p.kind);
        // Schild-Feedback: Treffer als cyan Funke, Schildbruch als Schockwelle
        if (shieldOnly) {
          this.particles.burstImpact(impactPos, 0x9be8ff);
        } else if (shieldBefore > 0 && hit.shield <= 0) {
          this.particles.shockwave(impactPos, 0x9be8ff, 4);
          this.sound.explosion(false);
        }
        // Kryo-Turm: Treffer verlangsamt den Gegner
        if (p.frost && !hit.dead) hit.applyFrost(p.frost, time);
        if (p.sourceId) {
          this.stats.damageByTower[p.sourceId] =
            (this.stats.damageByTower[p.sourceId] ?? 0) + p.damage;
        }
        if (p.splash > 0) {
          // Flächenschaden: Nachbarn am Einschlagsort mit 60 % treffen
          for (const e of this.enemies) {
            if (e === hit || e.dead) continue;
            if (e.position.distanceTo(impactPos) <= p.splash) {
              e.takeDamage(p.damage * 0.6, p.kind);
            }
          }
          this.particles.shockwave(impactPos, 0xff8a5c, p.splash * 1.8);
          this.particles.burstRock(impactPos, 6);
        }
        this.particles.burstImpact(impactPos, p.kind === 'bolt' ? 0x76FF03 : 0x4DD0E1);
      }
      if (p.dead) {
        p.removeFrom(this.world.scene);
        this.projectiles.splice(i, 1);
      }
    }

    // Tote Verteidiger entfernen
    for (let i = this.defenders.length - 1; i >= 0; i--) {
      const d = this.defenders[i];
      if (d.dead) {
        this.particles.burstRock(d.position.clone().add(new THREE.Vector3(0, 1, 0)), 8);
        this.removeDefender(d);
      }
    }

    // Tote / durchgebrochene Gegner
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.dead) {
        const pos = e.position.clone().add(new THREE.Vector3(0, 1.3, 0));
        this.stats.kills++;
        // individuelle Todes-Effekte je Gegnertyp
        if (e.data.id === 'panzerwalze') {
          this.particles.armorBurst(pos);
          this.sound.explosion(true);
        } else if (e.data.id === 'phasenspringer') {
          this.particles.implode(pos);
          this.sound.teleport();
        } else if (e.data.id === 'schwarmling') {
          this.particles.burstAlien(pos, 5);
          this.sound.explosion(false);
        } else if (e.data.isBoss) {
          this.particles.burstAlien(pos, 40);
          this.particles.firework(pos);
          this.particles.firework(pos.clone().add(new THREE.Vector3(2.5, 1, 0)));
          this.particles.firework(pos.clone().add(new THREE.Vector3(-2.5, 0.5, 0)));
          this.shakeT = Math.max(this.shakeT, 0.5);
          this.sound.explosion(true);
        } else if (e.data.kind === 'alien') {
          this.particles.burstAlien(pos, 14);
          this.sound.explosion(false);
        } else {
          this.particles.burstRock(pos, 12);
          this.sound.explosion(false);
        }
        // Berstbrocken & Co.: zerbirst in kleinere Gegner
        if (e.data.splitInto) {
          const s = e.data.splitInto;
          for (let k = 0; k < s.count; k++) {
            this.spawnMinion(s.type, e.lane, e.position.x + 0.6 - k * 1.2);
          }
          this.particles.shockwave(pos, 0xff8a3c, 3.5);
        }
        this.world.scene.remove(e.group);
        this.enemies.splice(i, 1);
      } else if (e.reachedCore) {
        this.integrity -= e.data.integrityDamage;
        this.hud.setIntegrity(Math.max(0, this.integrity));
        // Durchbruch-Drama: Shake, rote Vignette, Schockwelle am Kern
        this.shakeT = Math.max(this.shakeT, 0.4);
        this.hud.flashVignette();
        this.sound.breach();
        this.particles.flash(e.position.clone().add(new THREE.Vector3(0, 1.3, 0)), 0xFF5252);
        this.particles.shockwave(e.position.clone().add(new THREE.Vector3(1, 1, 0)), 0xff5252, 5);
        this.world.scene.remove(e.group);
        this.enemies.splice(i, 1);
        if (this.integrity <= 0) {
          this.gameOver();
          return;
        }
      }
    }

    // Wellen
    this.waves.update(dt, this.enemies.length);
    const counting = this.waves.state === 'countdown' && !this.waves.finished;
    if (counting) {
      this.hud.setWave(this.waves.waveIndex + 1, this.waves.totalWaves, this.waves.countdown);
      // Vorschau + Überspringen-Button während der Verschnaufpause
      if (this.lastPreviewWave !== this.waves.waveIndex) {
        this.lastPreviewWave = this.waves.waveIndex;
        this.hud.showWavePreview(this.waves.peekNextWave());
      }
      this.hud.setSkipButton(Math.ceil(Math.max(0, this.waves.countdown) * 2));
    } else {
      this.hud.setWave(this.waves.waveIndex + 1, this.waves.totalWaves);
      this.hud.setSkipButton(null);
    }
    this.hud.setWaveProgress(this.waves.levelProgress, this.endless ? this.waves.waveIndex + 1 : null);

    // Boss-HP-Leiste (aggregiert, falls mehrere Bosse leben)
    const bosses = this.enemies.filter((e) => e.data.isBoss && !e.dead);
    if (bosses.length > 0) {
      const hp = bosses.reduce((s, b) => s + Math.max(0, b.hp), 0);
      const max = bosses.reduce((s, b) => s + b.maxHp, 0);
      this.hud.showBossBar(hp / max, bosses.length, bosses.some((b) => b.isWeak));
    } else {
      this.hud.hideBossBar();
    }

    // Orbitalschlag-Button + HUD-Karten
    this.hud.setOrbital(this.orbitalCooldown, 45, this.energy >= 100, this.selectedType === 'orbital');
    this.hud.updateCards(this.energy, this.cooldowns);
  }
}
