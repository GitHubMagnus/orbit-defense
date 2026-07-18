// Gegner: bewegt sich von rechts nach links durch seine Lane, greift
// blockierende Verteidiger an, Zerstörer schießen zusätzlich auf Distanz.

import * as THREE from 'three';
import {
  buildEnemyMesh, spriteQuaternion, makeEliteAura, makeHitFlash, makeEnemyShield,
} from './meshFactory.js';
import { SPAWN_X, CORE_X, laneZ } from '../data/config.js';

export class Enemy {
  constructor(data, lane, opts = {}) {
    this.data = data;
    this.lane = lane;
    this.elite = !!opts.elite; // verstärkte Variante mit Gold-Aura
    const hpMul = this.elite ? 2.2 : 1;
    this.speedMul = this.elite ? 1.15 : 1;
    this.hp = Math.round(data.hp * hpMul);
    this.maxHp = this.hp;
    this.dead = false;
    this.reachedCore = false;
    this.slowFactor = 0;       // wird pro Frame von Traktorstrahlen gesetzt
    this.empUntil = 0;         // EMP-Power-up: gelähmt bis Zeitpunkt
    this.frostUntil = 0;       // Kryo-Turm: verlangsamt bis Zeitpunkt
    this.frostFactor = 0;
    this.cloaked = false;      // Phantom: getarnt (nicht anvisierbar)
    this.rangedTimer = data.rangedAttack ? data.rangedAttack.interval * 0.6 : 0;
    this.minionTimer = data.spawnMinions ? data.spawnMinions.interval : 0;
    this.teleportTimer = data.teleport ? data.teleport.interval * 0.8 : 0;
    this.waveOffset = Math.random() * Math.PI * 2;

    const built = buildEnemyMesh(data.id);
    this.group = built.group;
    this.animateMesh = built.animate;
    this.setWeakFn = built.setWeak ?? null;
    this.setCloakFn = built.setCloak ?? null;
    this.setAegisFn = built.setAegisActive ?? null;

    // Verhaltens-Zustände der neuen Gegner
    this.protected = false;          // Aegis-Schutzfeld (halber Schaden)
    this.cloakTimer = data.cloak ? data.cloak.visible : 0;
    this.exploded = false;           // Sprengdrohne
    this.group.scale.setScalar(data.scale * (this.elite ? 1.15 : 1));
    this.group.position.set(SPAWN_X, 0, laneZ(lane));

    // Elite-Markierung: pulsierende Gold-Aura mit Krone
    if (this.elite) {
      this.eliteAura = makeEliteAura(3.4);
      this.eliteAura.quaternion.copy(spriteQuaternion());
      this.eliteAura.position.y = 1.6;
      this.group.add(this.eliteAura);
    }

    // Treffer-Blitz (kurz sichtbar bei Schaden)
    this.hitFlash = makeHitFlash(2.6);
    this.hitFlash.quaternion.copy(spriteQuaternion());
    this.hitFlash.position.y = 1.5;
    this.group.add(this.hitFlash);
    this.flashT = 0;

    // Boss-Schwächephase: Zyklus geschlossen (9 s) -> offen (3.5 s, 2x Schaden)
    this.isWeak = false;
    this.weakCycleT = 0;

    // Energie-Schild: absorbiert Schaden zuerst. Nur Ionenpuls ('pulse') und
    // EMP ('emp') brechen es 4-fach schnell -> gezieltes Konterspiel.
    // Schilde tragen nur bestimmte Gegnertypen (Panzerwalze, Aegis-geschützte),
    // NICHT jeder Elite — sonst hat irgendwann alles ein Schild.
    this.shieldMax = data.shield ?? 0;
    this.shield = this.shieldMax;
    if (this.shieldMax > 0) {
      this.shieldMesh = makeEnemyShield(2.9 * data.scale);
      this.shieldMesh.quaternion.copy(spriteQuaternion());
      this.shieldMesh.position.y = 1.5;
      this.group.add(this.shieldMesh);
      this.shieldFlashT = 0;
    }

    // HP-Balken (zur festen Kamera orientiert)
    this.hpBar = makeHpBar();
    this.hpBar.position.y = data.hpBarHeight ?? 3.7;
    this.hpBar.visible = false;
    this.group.add(this.hpBar);
  }

  get position() {
    return this.group.position;
  }

  get shieldRatio() {
    return this.shieldMax > 0 ? Math.max(0, this.shield / this.shieldMax) : 0;
  }

  applyFrost(frost, now) {
    this.frostFactor = frost.factor;
    this.frostUntil = now + frost.duration;
  }

  // source = Projektil-/Effektart; gepanzerte Gegner widerstehen bestimmten Quellen
  // Rückgabe true, wenn (nur) das Schild getroffen wurde (für Treffer-Optik).
  takeDamage(amount, source) {
    const resist = source ? this.data.resist?.[source] : undefined;
    if (resist !== undefined) amount *= resist;
    if (this.protected) amount *= 0.5; // Aegis-Schutzfeld
    if (this.isWeak) amount *= 2; // Boss-Schwächephase: Schlund offen

    // Schild fängt Schaden zuerst ab; Ionenpuls/EMP durchdringen es 4-fach
    let hitShieldOnly = false;
    if (this.shield > 0) {
      const shieldMult = (source === 'pulse' || source === 'emp') ? 4 : 1;
      const toShield = amount * shieldMult;
      if (toShield < this.shield) {
        this.shield -= toShield;
        amount = 0;
        hitShieldOnly = true;
      } else {
        // Schild bricht: Überschuss (zurückgerechnet) trifft die Hülle
        const overflow = (toShield - this.shield) / shieldMult;
        this.shield = 0;
        amount = overflow;
      }
      this.shieldFlashT = 0.12;
    }

    if (amount > 0) {
      this.hp -= amount;
      this.flashT = 0.08;
      this.hitFlash.visible = true;
    }

    if (this.hp <= 0) {
      this.dead = true;
    } else if (amount > 0) {
      this.hpBar.visible = true;
      const ratio = Math.max(0, this.hp / this.maxHp);
      this.hpBar.userData.fill.scale.x = ratio;
      this.hpBar.userData.fill.position.x = -(1 - ratio) * 0.9;
    }
    return hitShieldOnly;
  }

  update(dt, time, ctx) {
    this.animateMesh(dt, time);

    // Treffer-Blitz ausblenden
    if (this.flashT > 0) {
      this.flashT -= dt;
      if (this.flashT <= 0) this.hitFlash.visible = false;
    }

    // Elite-Aura pulsiert
    if (this.eliteAura) {
      this.eliteAura.material.opacity = 0.6 + Math.sin(time * 5) * 0.3;
    }

    // Schild: sichtbar solange geladen, blitzt bei Treffern kurz auf
    if (this.shieldMesh) {
      if (this.shield <= 0) {
        this.shieldMesh.visible = false;
      } else {
        this.shieldMesh.visible = true;
        this.shieldMesh.rotation.z += dt * 0.6;
        const base = 0.35 + this.shieldRatio * 0.4 + Math.sin(time * 3) * 0.1;
        const flash = this.shieldFlashT > 0 ? 0.5 : 0;
        this.shieldMesh.material.opacity = Math.min(1, base + flash);
        if (this.shieldFlashT > 0) this.shieldFlashT -= dt;
      }
    }

    // Boss-Schwächephase takten
    if (this.data.isBoss) {
      this.weakCycleT += dt;
      if (!this.isWeak && this.weakCycleT >= 9) {
        this.isWeak = true;
        this.weakCycleT = 0;
        this.setWeakFn?.(true);
        ctx.particles.shockwave(this.position.clone().add(new THREE.Vector3(0, 2, 0)), 0xaefc4b, 5);
      } else if (this.isWeak && this.weakCycleT >= 3.5) {
        this.isWeak = false;
        this.weakCycleT = 0;
        this.setWeakFn?.(false);
      }
    }

    // Phantom: periodisch tarnen / enttarnen
    if (this.data.cloak) {
      this.cloakTimer -= dt;
      if (this.cloakTimer <= 0) {
        this.cloaked = !this.cloaked;
        this.cloakTimer = this.cloaked ? this.data.cloak.hidden : this.data.cloak.visible;
        this.setCloakFn?.(this.cloaked);
        ctx.particles.flash(this.position.clone().add(new THREE.Vector3(0, 1.4, 0)), 0x9b8cff);
      }
    }

    // Aegis-Träger: Schutzfeld-Indikator (Schutz wird zentral im Game gesetzt)
    if (this.setAegisFn) this.setAegisFn(!this.dead);

    if (time < this.empUntil) {
      this.slowFactor = Math.max(this.slowFactor, 0.85); // EMP: fast stillgelegt
    }
    if (time < this.frostUntil) {
      this.slowFactor = Math.max(this.slowFactor, this.frostFactor); // Kryo-Verlangsamung
    }
    const speed = this.data.speed * this.speedMul * (1 - this.slowFactor);
    this.slowFactor = 0; // wird jeden Frame neu gesetzt

    // Blockierenden Verteidiger direkt vor uns suchen (gleiche Lane, Nahbereich)
    const blocker = this.findBlocker(ctx.defenders);
    if (blocker) {
      // Sprengdrohne: explodiert beim ersten Gebäude mit Flächenschaden an Türmen
      if (this.data.kamikaze && !this.exploded) {
        this.exploded = true;
        this.dead = true;
        const kb = this.data.kamikaze;
        const boom = this.position.clone().add(new THREE.Vector3(0, 1, 0));
        for (const d of ctx.defenders) {
          if (!d.dead && d.position.distanceTo(this.position) <= kb.radius) {
            d.takeDamage(kb.damage);
          }
        }
        ctx.particles.shockwave(boom, 0xff8a5c, kb.radius * 1.8);
        ctx.particles.burstAlien(boom, 20);
        ctx.sfx?.explosion(true);
      } else {
        blocker.takeDamage(this.data.meleeDps * dt);
      }
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

    // Phasenspringer: teleportiert periodisch ein Stück nach vorn
    if (this.data.teleport) {
      this.teleportTimer -= dt;
      if (this.teleportTimer <= 0) {
        this.teleportTimer = this.data.teleport.interval;
        const from = this.position.clone().add(new THREE.Vector3(0, 1.4, 0));
        this.position.x = Math.max(CORE_X + 2, this.position.x - this.data.teleport.distance);
        const to = this.position.clone().add(new THREE.Vector3(0, 1.4, 0));
        ctx.particles.flash(from, 0xc26bd6);
        ctx.particles.flash(to, 0x7df3ff);
        ctx.particles.burstImpact(to, 0xc26bd6);
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
