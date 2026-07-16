// Energie-System: gelbe Blitz-Pickups, die durchs Spielfeld treiben oder von
// Solarkollektoren erzeugt und per Klick eingesammelt werden.

import * as THREE from 'three';
import { spritePlane, spriteQuaternion } from '../entities/meshFactory.js';
import {
  LANES, laneZ, colX, COLS,
  CRYSTAL_VALUE, CRYSTAL_SPAWN_MIN, CRYSTAL_SPAWN_MAX, CRYSTAL_LIFETIME,
} from '../data/config.js';

function makeGem() {
  return spritePlane('energy-bolt', 160, 192, 1.2, 1.45, (ctx) => {
    // klassischer Zickzack-Blitz
    const grad = ctx.createLinearGradient(60, 10, 100, 182);
    grad.addColorStop(0, '#fff7c0');
    grad.addColorStop(0.45, '#ffd23f');
    grad.addColorStop(1, '#ff9800');
    ctx.fillStyle = grad;
    ctx.strokeStyle = '#7a4d00';
    ctx.lineWidth = 8;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(96, 8);
    ctx.lineTo(34, 106);
    ctx.lineTo(72, 106);
    ctx.lineTo(56, 184);
    ctx.lineTo(126, 78);
    ctx.lineTo(88, 78);
    ctx.lineTo(114, 8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Glanzkante
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.beginPath();
    ctx.moveTo(94, 16); ctx.lineTo(52, 92); ctx.lineTo(64, 92); ctx.lineTo(100, 16);
    ctx.closePath(); ctx.fill();
  });
}

function makeHalo() {
  return spritePlane('energy-halo', 128, 128, 2.3, 2.3, (ctx) => {
    const g = ctx.createRadialGradient(64, 64, 8, 64, 64, 60);
    g.addColorStop(0, 'rgba(255,222,90,0.8)');
    g.addColorStop(1, 'rgba(255,190,50,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(64, 64, 60, 0, Math.PI * 2); ctx.fill();
  }, { additive: true });
}

function makeSparkle() {
  return spritePlane('energy-sparkle', 96, 96, 0.65, 0.65, (ctx) => {
    ctx.translate(48, 48);
    ctx.fillStyle = '#fff7c0';
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      ctx.rotate(Math.PI / 2);
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(6, -6, 0, -40);
      ctx.quadraticCurveTo(-6, -6, 0, 0);
    }
    ctx.fill();
  }, { additive: true });
}

export class CrystalSystem {
  constructor(scene) {
    this.scene = scene;
    this.crystals = [];
    this.spawnTimer = 4; // erster ambienter Kristall kommt früh
  }

  reset() {
    for (const c of this.crystals) this.scene.remove(c.group);
    this.crystals = [];
    this.spawnTimer = 4;
  }

  update(dt, time) {
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = CRYSTAL_SPAWN_MIN + Math.random() * (CRYSTAL_SPAWN_MAX - CRYSTAL_SPAWN_MIN);
      this.spawnAmbient();
    }
    for (let i = this.crystals.length - 1; i >= 0; i--) {
      const c = this.crystals[i];
      c.life -= dt;
      if (c.life <= 0) {
        this.scene.remove(c.group);
        this.crystals.splice(i, 1);
        continue;
      }
      c.group.position.addScaledVector(c.drift, dt);
      c.group.position.y = c.baseY + Math.sin(time * 2.2 + c.phase) * 0.25;
      // Edelstein pendelt, Funkelstern blitzt
      c.gem.rotation.z = Math.sin(time * 2.6 + c.phase) * 0.22;
      const tw = Math.max(0, Math.sin(time * 4.5 + c.phase));
      c.sparkle.scale.setScalar(0.4 + tw * 0.9);
      c.sparkle.material.opacity = 0.25 + tw * 0.75;
      c.halo.scale.setScalar(1 + Math.sin(time * 3 + c.phase) * 0.12);
      // Verglühen ankündigen: Blinken in den letzten 3 Sekunden
      const blink = c.life < 3 ? (Math.sin(time * 12) > 0 ? 1 : 0.25) : 1;
      c.gem.material.opacity = blink;
      c.halo.material.opacity = 0.8 * blink;
    }
  }

  // Kristall treibt zufällig durchs Spielfeld
  spawnAmbient() {
    const lane = Math.floor(Math.random() * LANES);
    const col = 1 + Math.floor(Math.random() * (COLS - 2));
    const pos = new THREE.Vector3(colX(col), 1.7, laneZ(lane));
    const drift = new THREE.Vector3((Math.random() - 0.5) * 0.5, 0, (Math.random() - 0.5) * 0.3);
    this.spawn(pos, drift);
  }

  // von Solarkollektoren erzeugt: hüpft neben die Einheit
  spawnAt(pos) {
    const p = pos.clone();
    p.y = 1.7;
    p.x += (Math.random() - 0.5) * 1.5;
    p.z += (Math.random() - 0.5) * 1.0;
    this.spawn(p, new THREE.Vector3(0, 0, 0));
  }

  spawn(pos, drift) {
    const group = new THREE.Group();
    group.quaternion.copy(spriteQuaternion());

    const halo = makeHalo();
    halo.position.z = -0.02;
    group.add(halo);

    const gem = makeGem();
    group.add(gem);

    const sparkle = makeSparkle();
    sparkle.position.set(0.3, 0.42, 0.04);
    group.add(sparkle);

    group.position.copy(pos);
    this.scene.add(group);
    this.crystals.push({
      group, gem, halo, sparkle, drift,
      life: CRYSTAL_LIFETIME,
      baseY: pos.y,
      phase: Math.random() * Math.PI * 2,
      value: CRYSTAL_VALUE,
    });
  }

  // Klick-Prüfung per Raycaster; gibt eingesammelten Wert zurück (oder null)
  tryCollect(raycaster) {
    for (let i = 0; i < this.crystals.length; i++) {
      const c = this.crystals[i];
      const hits = raycaster.intersectObject(c.group, true);
      if (hits.length > 0) {
        const pos = c.group.position.clone();
        this.scene.remove(c.group);
        this.crystals.splice(i, 1);
        return { value: c.value, position: pos };
      }
    }
    return null;
  }
}
