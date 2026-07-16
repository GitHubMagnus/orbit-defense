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
import { DEFENDER_TYPES } from './data/defenders.js';
import { ENEMY_TYPES } from './data/enemies.js';
import { LEVELS } from './data/levels.js';
import { loadProgress, unlockAfterWin } from './systems/progress.js';
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
    this.hud = new HUD({
      onSelectUnit: (t) => { this.selectedType = t; },
      onStartLevel: (i) => this.startLevel(i),
      onRestart: () => this.startLevel(this.currentLevel),
      onLevelSelect: () => this.hud.showScreen('start'),
      onDragStart: (t, ev) => this.startDrag(t, ev),
    });
    this.hud.refreshMeta(this.progress, LEVELS);

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

  startLevel(levelIndex) {
    if (levelIndex + 1 > this.progress.levelsUnlocked) return; // noch gesperrt
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
    this.selectedType = null;
    this.hud.select(null);
    this.hud.hideBuildMenu();

    this.waves = new WaveManager(LEVELS[levelIndex], {
      spawnEnemy: (type, lane) => this.spawnEnemy(type, lane),
      onWaveStart: (i, wave) => {
        this.hud.showBanner(`WELLE ${i + 1}`, wave.label ?? '', !!wave.danger);
      },
      onAllWavesCleared: () => this.win(),
    });

    this.phase = 'playing';
    this.hud.showScreen('game');
    this.hud.setEnergy(this.energy);
    this.hud.setIntegrity(this.integrity);
    this.hud.showBanner('SYSTEME ONLINE', 'Baue deine Verteidigung auf!');
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
    this.hud.setGameoverStats(this.waves.waveIndex + 1, this.waves.totalWaves);
    this.hud.showScreen('gameover');
  }

  win() {
    // Feuerwerks-Animation, dann Sieg-Screen mit Freischaltungen
    this.phase = 'winAnim';
    this.winAnimT = 0;
    this.fireworkTimer = 0;
    this.hud.showBanner('SEKTOR GESICHERT!', LEVELS[this.currentLevel].name);
    this.pendingUnlocks = unlockAfterWin(this.progress, this.currentLevel, LEVELS.length);
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
      this.hud.showWinScreen(this.pendingUnlocks, LEVELS, this.currentLevel);
    }
  }

  // ---------- Spawning ----------

  spawnEnemy(type, lane) {
    const enemy = new Enemy(ENEMY_TYPES[type], lane);
    this.world.scene.add(enemy.group);
    this.enemies.push(enemy);
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

  // von der HUD-Karte aus gestartet (pointerdown auf einer Einheiten-Karte)
  startDrag(typeId, ev) {
    if (this.phase !== 'playing') return;
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
    if (cell && this.selectedType === 'recycler') {
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
      const free = !this.grid[cell.lane][cell.col];
      const affordable = this.energy >= DEFENDER_TYPES[this.selectedType].cost;
      const ready = (this.cooldowns[this.selectedType] ?? 0) <= 0;
      this.highlight.material.color.set(free && affordable && ready ? 0x4DD0E1 : 0xFF5252);
    } else {
      this.highlight.visible = false;
    }
  }

  onLeftClick(ev) {
    if (this.phase !== 'playing') return;
    this.updateRaycaster(ev);
    this.hud.hideBuildMenu();

    // 1) Power-up einsammeln hat höchsten Vorrang
    const powerup = this.powerups.tryCollect(this.raycaster);
    if (powerup) {
      this.applyPowerup(powerup.type, powerup.position);
      return;
    }

    // 2) Energie-Blitz einsammeln (Skill "Ladekerne": +10 extra)
    const collected = this.crystals.tryCollect(this.raycaster);
    if (collected) {
      const value = collected.value + (this.progress.skills.includes('ladekerne') ? 10 : 0);
      this.energy += value;
      this.hud.setEnergy(this.energy, true);
      this.particles.burstCrystal(collected.position);
      this.hud.floatText(ev.clientX, ev.clientY, `+${value}`);
      return;
    }

    this.handleFieldAction(ev);
  }

  // Recycler / Ausbau-Menü / Platzierung — genutzt von Klick UND Drag & Drop
  handleFieldAction(ev) {
    const cell = this.pickCell(ev);
    if (!cell) return;
    const occupant = this.grid[cell.lane][cell.col];

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

    // Einheit platzieren
    if (!this.selectedType) return;
    const data = DEFENDER_TYPES[this.selectedType];
    if (this.energy < data.cost) return;
    if ((this.cooldowns[this.selectedType] ?? 0) > 0) return;

    const defender = new Defender(data, cell.lane, cell.col);
    this.world.scene.add(defender.group);
    this.defenders.push(defender);
    this.grid[cell.lane][cell.col] = defender;
    this.energy -= data.cost;
    // Skill "Schnell-Kühlung": Abklingzeiten -25 %
    const cdFactor = this.progress.skills.includes('schnellkuehlung') ? 0.75 : 1;
    this.cooldowns[data.id] = data.cooldown * cdFactor;
    this.hud.setEnergy(this.energy);
    this.particles.burstImpact(defender.position.clone().add(new THREE.Vector3(0, 1, 0)));
  }

  sellDefender(defender, screenX, screenY) {
    const refund = defender.refundValue;
    this.energy += refund;
    this.hud.setEnergy(this.energy, true);
    this.hud.floatText(screenX, screenY, `+${refund}`);
    this.particles.burstImpact(defender.position.clone().add(new THREE.Vector3(0, 1.5, 0)), 0xff8a5c);
    this.removeDefender(defender);
  }

  openBuildMenu(defender, x, y) {
    this.hud.showBuildMenu(defender, x, y, {
      energy: this.energy,
      onUpgrade: (pathKey) => {
        if (!defender.canUpgrade || this.energy < defender.upgradeCost) return;
        this.energy -= defender.upgradeCost;
        defender.upgrade(pathKey);
        this.hud.setEnergy(this.energy, true);
        this.particles.burstImpact(defender.position.clone().add(new THREE.Vector3(0, 2.4, 0)), 0xffd23f);
        this.particles.shockwave(defender.position.clone().add(new THREE.Vector3(0, 1, 0)), 0xffd23f, 3);
        // Menü mit frischen Werten neu zeichnen
        this.openBuildMenu(defender, x, y);
      },
      onSell: () => {
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
    }
  }

  // Rechtsklick: Info-Tooltip; zweiter Rechtsklick auf dieselbe Einheit verkauft
  onRightClick(ev) {
    if (this.phase !== 'playing') return;
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
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.elapsed += dt;
    const time = this.elapsed;

    this.world.updateEnvironment(dt, time);
    this.particles.update(dt);

    if (this.phase === 'playing') {
      this.update(dt, time);
    } else if (this.phase === 'winAnim') {
      this.updateWinAnim(dt);
    }

    this.world.composer.render();
  }

  update(dt, time) {
    const ctx = {
      enemies: this.enemies,
      defenders: this.defenders,
      particles: this.particles,
      overcharged: time < this.buffs.overchargeUntil,
      spawnProjectile: (k, f, t, d, o) => this.spawnProjectile(k, f, t, d, o),
      spawnEnemyBolt: (f, t, d) => this.spawnEnemyBolt(f, t, d),
      spawnCrystalAt: (pos) => this.crystals.spawnAt(pos),
      spawnMinion: (type, lane, x) => this.spawnMinion(type, lane, x),
    };

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

    // Projektile
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      const hit = p.update(dt);
      if (hit && !hit.dead) {
        const impactPos = p.mesh.position.clone();
        hit.takeDamage(p.damage, p.kind);
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
        if (e.data.kind === 'alien') {
          this.particles.burstAlien(pos, e.data.isBoss ? 40 : 14);
        } else {
          this.particles.burstRock(pos, 12);
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
        this.particles.flash(e.position.clone().add(new THREE.Vector3(0, 1.3, 0)), 0xFF5252);
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
    if (this.waves.state === 'countdown' && !this.waves.finished) {
      this.hud.setWave(this.waves.waveIndex + 1, this.waves.totalWaves, this.waves.countdown);
    } else {
      this.hud.setWave(this.waves.waveIndex + 1, this.waves.totalWaves);
    }

    // HUD-Karten
    this.hud.updateCards(this.energy, this.cooldowns);
  }
}
