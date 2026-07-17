// Platzierte Verteidiger-Einheit. Verhalten wird über data.behavior gesteuert
// (shooter | generator | blocker | slower | pulse | healer). Jede Einheit ist
// zweimal ausbaubar; pro Ausbau wählt der Spieler Pfad A (Kraft: Schaden/Hülle/
// Heilung) oder Pfad B (Tempo: Feuerrate/Produktion/Reichweite). Beschädigung
// ist in zwei sichtbaren Stufen ablesbar, Ausbauten verändern das Modell.

import * as THREE from 'three';
import { buildDefenderMesh } from './meshFactory.js';
import { MAX_LEVEL, UPGRADE_COST_FACTOR } from '../data/defenders.js';
import { colX, laneZ, SELL_REFUND } from '../data/config.js';

export class Defender {
  constructor(data, lane, col) {
    this.data = data;
    this.lane = lane;
    this.col = col;
    this.upA = 0; // Kraft-Pfad (Schaden/Hülle/Heilrate/Sog)
    this.upB = 0; // Tempo-Pfad (Feuerrate/Produktion/Reichweite/Regeneration)
    this.invested = data.cost;
    this.hp = data.hp;
    this.maxHp = data.hp;
    this.dead = false;

    this.fireTimer = data.fireInterval ? data.fireInterval * 0.5 : 0;
    this.generateTimer = data.generateInterval ?? 0;
    this.pulseTimer = data.pulseInterval ? data.pulseInterval * 0.5 : 0;
    this.healFxTimer = 0;
    this.sparkTimer = 0;
    this.recoilT = 0; // kurzer Rückstoß-Hüpfer nach dem Schuss

    const built = buildDefenderMesh(data.id);
    this.group = built.group;
    this.animateMesh = built.animate;
    this.setDamageFn = built.setDamage ?? (() => {});
    this.setLevelFn = built.setLevel ?? (() => {});
    this.group.position.set(colX(col), 0, laneZ(lane));
  }

  get position() {
    return this.group.position;
  }

  get level() {
    return 1 + this.upA + this.upB;
  }

  // ---------- effektive Stats je Ausbau-Pfad ----------

  get damage() {
    return (this.data.damage ?? 0) * 1.5 ** this.upA;
  }

  get fireInterval() {
    return (this.data.fireInterval ?? 1) * 0.75 ** this.upB;
  }

  get pulseInterval() {
    return (this.data.pulseInterval ?? 1) * 0.75 ** this.upB;
  }

  get generateInterval() {
    return (this.data.generateInterval ?? 1) * 0.75 ** this.upB;
  }

  get slowFactor() {
    return Math.min(0.8, (this.data.slowFactor ?? 0) + 0.12 * this.upA);
  }

  get healPerSec() {
    return (this.data.healPerSec ?? 0) * 1.5 ** this.upA;
  }

  get range() {
    const b = this.data.behavior;
    const mul = (b === 'slower' || b === 'healer') ? 1 + 0.25 * this.upB : 1;
    return (this.data.range ?? 0) * mul;
  }

  // Blocker-Pfad B: Selbstreparatur pro Sekunde
  get selfRepair() {
    return this.data.behavior === 'blocker' ? this.upB * 5 : 0;
  }

  computeMaxHp() {
    let mul = 1 + 0.25 * (this.upA + this.upB);
    // Hüllen-/Panzerungs-Pfad gibt kräftig extra
    if (this.data.behavior === 'generator' || this.data.behavior === 'blocker') {
      mul += 0.55 * this.upA;
    }
    return Math.round(this.data.hp * mul);
  }

  // ---------- Ausbau & Verkauf ----------

  get canUpgrade() {
    return this.level < MAX_LEVEL;
  }

  get upgradeCost() {
    return Math.ceil(this.data.cost * UPGRADE_COST_FACTOR);
  }

  get refundValue() {
    return Math.floor(this.invested * SELL_REFUND);
  }

  upgrade(pathKey) {
    if (!this.canUpgrade) return false;
    if (pathKey === 'b') this.upB++; else this.upA++;
    this.invested += this.upgradeCost;
    const newMax = this.computeMaxHp();
    this.hp += newMax - this.maxHp;
    this.maxHp = newMax;
    this.setLevelFn(this.level);
    this.updateDamageStage();
    return true;
  }

  // ---------- Schaden & Reparatur ----------

  takeDamage(amount) {
    this.hp -= amount;
    if (this.hp <= 0) {
      this.dead = true;
    } else {
      this.updateDamageStage();
    }
  }

  heal(amount) {
    if (this.hp >= this.maxHp) return 0;
    const healed = Math.min(amount, this.maxHp - this.hp);
    this.hp += healed;
    this.updateDamageStage();
    return healed;
  }

  updateDamageStage() {
    const ratio = this.hp / this.maxHp;
    this.setDamageFn(ratio > 2 / 3 ? 0 : ratio > 1 / 3 ? 1 : 2);
  }

  // ---------- Verhalten pro Frame ----------

  update(dt, time, ctx) {
    this.animateMesh(dt, time);

    // Rückstoß-Feedback: kurzer Squash nach jedem Schuss
    if (this.recoilT > 0) {
      this.recoilT = Math.max(0, this.recoilT - dt);
      const k = this.recoilT / 0.15;
      this.group.scale.set(1 + 0.06 * k, 1 - 0.06 * k, 1);
    } else if (this.group.scale.x !== 1) {
      this.group.scale.set(1, 1, 1);
    }

    // schwer beschädigt: gelegentlich Funken sprühen
    if (this.hp / this.maxHp <= 1 / 3) {
      this.sparkTimer -= dt;
      if (this.sparkTimer <= 0) {
        this.sparkTimer = 1.0 + Math.random() * 0.8;
        const p = this.position.clone().add(new THREE.Vector3(
          (Math.random() - 0.5) * 1.2, 1.4 + Math.random(), 0.3
        ));
        ctx.particles.burstImpact(p, 0xffb300);
      }
    }

    const d = this.data;
    if (d.behavior === 'shooter') {
      // Überladung-Power-up: doppelte Feuerrate
      this.fireTimer -= ctx.overcharged ? dt * 2 : dt;
      const target = this.findTarget(ctx.enemies);
      if (target && this.fireTimer <= 0) {
        this.fireTimer = this.fireInterval;
        const muzzle = this.position.clone().add(
          this.group.userData.muzzleOffset ?? new THREE.Vector3(0, 1.8, 0)
        );
        ctx.spawnProjectile(d.projectile, muzzle, target, this.damage, {
          splash: d.splash, sourceId: d.id,
        });
        // Feuer-Feedback: Rückstoß + Mündungsblitz + Sound
        this.recoilT = 0.15;
        const flashColor = d.projectile === 'plasma' ? 0xff9be4
          : d.projectile === 'rakete' ? 0xffb46b : 0x7df3ff;
        ctx.particles.muzzle(muzzle, flashColor);
        ctx.sfx?.shot(d.projectile);
      }
    } else if (d.behavior === 'generator') {
      this.generateTimer -= dt;
      if (this.generateTimer <= 0) {
        this.generateTimer = this.generateInterval;
        ctx.spawnCrystalAt(this.position.clone());
      }
    } else if (d.behavior === 'slower') {
      for (const e of ctx.enemies) {
        if (e.position.distanceTo(this.position) <= this.range) {
          e.slowFactor = Math.max(e.slowFactor, this.slowFactor);
        }
      }
    } else if (d.behavior === 'pulse') {
      this.pulseTimer -= ctx.overcharged ? dt * 2 : dt;
      if (this.pulseTimer <= 0) {
        const targets = ctx.enemies.filter(
          (e) => !e.dead && e.position.distanceTo(this.position) <= d.range
        );
        if (targets.length > 0) {
          this.pulseTimer = this.pulseInterval;
          for (const e of targets) e.takeDamage(this.damage, 'pulse');
          ctx.recordDamage?.(d.id, this.damage * targets.length);
          const c = this.position.clone().add(new THREE.Vector3(0, 0.6, 0));
          ctx.particles.shockwave(c, 0x7df3ff, d.range * 1.6);
          ctx.particles.flash(this.position.clone().add(new THREE.Vector3(0, 2.6, 0)), 0x7df3ff);
          this.recoilT = 0.15;
          ctx.sfx?.shot('pulse');
        }
      }
    } else if (d.behavior === 'healer') {
      let healedAny = null;
      for (const other of ctx.defenders) {
        if (other === this || other.dead) continue;
        if (other.position.distanceTo(this.position) > this.range) continue;
        if (other.heal(this.healPerSec * dt) > 0) healedAny = other;
      }
      // grüne Funken auf dem reparierten Gebäude
      if (healedAny) {
        this.healFxTimer -= dt;
        if (this.healFxTimer <= 0) {
          this.healFxTimer = 1.4;
          ctx.particles.burstImpact(
            healedAny.position.clone().add(new THREE.Vector3(0, 2.2, 0)), 0x3ecf6a
          );
        }
      }
    } else if (d.behavior === 'blocker') {
      // Ausbau-Pfad B: Schild repariert sich selbst
      if (this.selfRepair > 0) this.heal(this.selfRepair * dt);
    }
  }

  // Vorderster Gegner in derselben Lane innerhalb der Reichweite
  findTarget(enemies) {
    let best = null;
    for (const e of enemies) {
      if (e.lane !== this.lane || e.dead) continue;
      const dx = e.position.x - this.position.x;
      if (dx < -1 || dx > this.data.range) continue;
      if (!best || e.position.x < best.position.x) best = e;
    }
    return best;
  }
}
