// Gegner: bewegt sich von rechts nach links durch seine Lane, greift
// blockierende Verteidiger an, Zerstörer schießen zusätzlich auf Distanz.

import * as THREE from 'three';
import { buildEnemyMesh, spriteQuaternion } from './meshFactory.js';
import { SPAWN_X, CORE_X, laneZ } from '../data/config.js';

export class Enemy {
  constructor(data, lane) {
    this.data = data;
    this.lane = lane;
    this.hp = data.hp;
    this.maxHp = data.hp;
    this.dead = false;
    this.reachedCore = false;
    this.slowFactor = 0;       // wird pro Frame von Traktorstrahlen gesetzt
    this.empUntil = 0;         // EMP-Power-up: gelähmt bis Zeitpunkt
    this.rangedTimer = data.rangedAttack ? data.rangedAttack.interval * 0.6 : 0;
    this.minionTimer = data.spawnMinions ? data.spawnMinions.interval : 0;
    this.waveOffset = Math.random() * Math.PI * 2;

    const built = buildEnemyMesh(data.id);
    this.group = built.group;
    this.animateMesh = built.animate;
    this.group.scale.setScalar(data.scale);
    this.group.position.set(SPAWN_X, 0, laneZ(lane));

    // HP-Balken (zur festen Kamera orientiert)
    this.hpBar = makeHpBar();
    this.hpBar.position.y = data.hpBarHeight ?? 3.7;
    this.hpBar.visible = false;
    this.group.add(this.hpBar);
  }

  get position() {
    return this.group.position;
  }

  takeDamage(amount) {
    this.hp -= amount;
    if (this.hp <= 0) {
      this.dead = true;
    } else {
      this.hpBar.visible = true;
      const ratio = Math.max(0, this.hp / this.maxHp);
      this.hpBar.userData.fill.scale.x = ratio;
      this.hpBar.userData.fill.position.x = -(1 - ratio) * 0.9;
    }
  }

  update(dt, time, ctx) {
    this.animateMesh(dt, time);

    if (time < this.empUntil) {
      this.slowFactor = Math.max(this.slowFactor, 0.85); // EMP: fast stillgelegt
    }
    const speed = this.data.speed * (1 - this.slowFactor);
    this.slowFactor = 0; // wird jeden Frame neu gesetzt

    // Blockierenden Verteidiger direkt vor uns suchen (gleiche Lane, Nahbereich)
    const blocker = this.findBlocker(ctx.defenders);
    if (blocker) {
      blocker.takeDamage(this.data.meleeDps * dt);
    } else {
      this.position.x -= speed * dt;
    }

    // Drohnen fliegen wellenförmig
    if (this.data.waveMotion) {
      const w = this.data.waveMotion;
      this.position.z = laneZ(this.lane) +
        Math.sin(time * w.frequency + this.waveOffset) * w.amplitude;
      this.position.y = Math.sin(time * w.frequency * 0.7 + this.waveOffset) * 0.3;
    }

    // Zerstörer: Fernangriff auf Türme in der Lane
    if (this.data.rangedAttack) {
      this.rangedTimer -= dt;
      if (this.rangedTimer <= 0) {
        const ra = this.data.rangedAttack;
        const target = this.findDefenderInRange(ctx.defenders, ra.range);
        if (target) {
          this.rangedTimer = ra.interval;
          const muzzle = this.position.clone().add(new THREE.Vector3(-1.4, 1.4, 0));
          ctx.spawnEnemyBolt(muzzle, target, ra.damage);
        }
      }
    }

    // Boss: spawnt periodisch Drohnen als Verstärkung
    if (this.data.spawnMinions) {
      this.minionTimer -= dt;
      if (this.minionTimer <= 0) {
        this.minionTimer = this.data.spawnMinions.interval;
        ctx.spawnMinion(this.data.spawnMinions.type, this.lane, this.position.x - 1);
      }
    }

    if (this.position.x <= CORE_X) {
      this.reachedCore = true;
    }
  }

  // Verteidiger, an dem wir "kleben" (PvZ-Stil: Gegner stoppt und frisst)
  findBlocker(defenders) {
    for (const d of defenders) {
      if (d.lane !== this.lane || d.dead) continue;
      const dx = this.position.x - d.position.x;
      if (dx > 0 && dx < 1.7) return d;
    }
    return null;
  }

  findDefenderInRange(defenders, range) {
    let best = null;
    for (const d of defenders) {
      if (d.lane !== this.lane || d.dead) continue;
      const dx = this.position.x - d.position.x;
      if (dx > 0 && dx <= range) {
        if (!best || d.position.x > best.position.x) best = d; // nächstgelegener
      }
    }
    return best;
  }
}

function makeHpBar() {
  const bar = new THREE.Group();
  const bg = new THREE.Mesh(
    new THREE.PlaneGeometry(1.9, 0.24),
    new THREE.MeshBasicMaterial({ color: 0x1b2447, transparent: true, opacity: 0.85 })
  );
  const fill = new THREE.Mesh(
    new THREE.PlaneGeometry(1.8, 0.15),
    new THREE.MeshBasicMaterial({ color: 0xff5252 })
  );
  fill.position.z = 0.01;
  bar.add(bg);
  bar.add(fill);
  bar.quaternion.copy(spriteQuaternion()); // zur fixen Kamera ausgerichtet
  bar.userData.fill = fill;
  return bar;
}
