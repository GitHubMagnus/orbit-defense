// Power-up-System: seltene, einsammelbare Boni, die durchs Spielfeld treiben.
// Wie die Energie-Blitze per Klick einsammeln — Effekt wirkt sofort.

import * as THREE from 'three';
import { spritePlane, spriteQuaternion } from '../entities/meshFactory.js';
import { LANES, laneZ, colX, COLS } from '../data/config.js';

const SPAWN_MIN = 24;
const SPAWN_MAX = 40;
const LIFETIME = 13;

// Datengetriebene Power-up-Typen; Effekte wendet game.applyPowerup an.
export const POWERUP_TYPES = {
  ueberladung: {
    id: 'ueberladung',
    name: 'ÜBERLADUNG',
    description: 'Alle Türme feuern 10 s lang doppelt so schnell!',
    color: 0xffd23f,
    weight: 4,
  },
  emp: {
    id: 'emp',
    name: 'EMP-PULS',
    description: 'Trifft alle Gegner und lähmt sie 3 s lang!',
    color: 0xc26bd6,
    weight: 3,
  },
  reparatur: {
    id: 'reparatur',
    name: 'REPARATUR-KIT',
    description: 'Alle Gebäude werden um 50 % repariert!',
    color: 0x3ecf6a,
    weight: 3,
  },
  magnet: {
    id: 'magnet',
    name: 'ENERGIE-MAGNET',
    description: 'Zieht alle Energie-Blitze auf dem Feld auf einmal ein!',
    color: 0x40e0ff,
    weight: 3,
  },
};

function drawToken(ctx, ringColor, symbol) {
  // runde Bonus-Münze mit Leuchtring
  const c = 96;
  const halo = ctx.createRadialGradient(c, c, 30, c, c, 92);
  halo.addColorStop(0, 'rgba(255,255,255,0.0)');
  halo.addColorStop(0.7, ringColor.replace('ALPHA', '0.45'));
  halo.addColorStop(1, ringColor.replace('ALPHA', '0'));
  ctx.fillStyle = halo;
  ctx.beginPath(); ctx.arc(c, c, 92, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = 'rgba(16,26,56,0.92)';
  ctx.beginPath(); ctx.arc(c, c, 58, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = ringColor.replace('ALPHA', '1');
  ctx.lineWidth = 9;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(c, c, 49, 0, Math.PI * 2); ctx.stroke();

  symbol(ctx, c);
}

function tokenPlane(type) {
  if (type === 'ueberladung') {
    return spritePlane('pu-ueberladung', 192, 192, 1.9, 1.9, (ctx) => {
      drawToken(ctx, 'rgba(255,210,63,ALPHA)', (c2, c) => {
        // Doppel-Blitz
        c2.fillStyle = '#ffd23f';
        c2.strokeStyle = '#7a4d00'; c2.lineWidth = 5; c2.lineJoin = 'round';
        for (const dx of [-14, 14]) {
          c2.beginPath();
          c2.moveTo(c + dx + 8, c - 34);
          c2.lineTo(c + dx - 12, c + 4); c2.lineTo(c + dx, c + 4);
          c2.lineTo(c + dx - 8, c + 34); c2.lineTo(c + dx + 12, c - 4); c2.lineTo(c + dx, c - 4);
          c2.closePath(); c2.fill(); c2.stroke();
        }
      });
    });
  }
  if (type === 'emp') {
    return spritePlane('pu-emp', 192, 192, 1.9, 1.9, (ctx) => {
      drawToken(ctx, 'rgba(194,107,214,ALPHA)', (c2, c) => {
        // Puls-Wellen + Kern
        c2.strokeStyle = '#e3a7f0'; c2.lineWidth = 6; c2.lineCap = 'round';
        c2.beginPath(); c2.arc(c, c, 16, -0.6, 2.5); c2.stroke();
        c2.beginPath(); c2.arc(c, c, 30, 0.8, 3.6); c2.stroke();
        c2.fillStyle = '#ffffff';
        c2.beginPath(); c2.arc(c, c, 8, 0, Math.PI * 2); c2.fill();
      });
    });
  }
  if (type === 'magnet') {
    return spritePlane('pu-magnet', 192, 192, 1.9, 1.9, (ctx) => {
      drawToken(ctx, 'rgba(64,224,255,ALPHA)', (c2, c) => {
        // Hufeisen-Magnet
        c2.lineWidth = 15; c2.lineCap = 'butt';
        c2.strokeStyle = '#40e0ff';
        c2.beginPath(); c2.arc(c, c - 2, 24, Math.PI, 0); c2.stroke();
        c2.beginPath(); c2.moveTo(c - 24, c - 2); c2.lineTo(c - 24, c + 26); c2.stroke();
        c2.beginPath(); c2.moveTo(c + 24, c - 2); c2.lineTo(c + 24, c + 26); c2.stroke();
        // Pol-Kappen
        c2.fillStyle = '#eaffff';
        c2.fillRect(c - 31, c + 22, 14, 8);
        c2.fillRect(c + 17, c + 22, 14, 8);
        // eingezogene Blitze
        c2.fillStyle = '#ffd23f';
        for (const [bx, by] of [[c - 34, c - 20], [c + 34, c - 18]]) {
          c2.beginPath();
          c2.moveTo(bx + 3, by - 8); c2.lineTo(bx - 4, by + 2); c2.lineTo(bx, by + 2);
          c2.lineTo(bx - 3, by + 10); c2.lineTo(bx + 5, by - 1); c2.lineTo(bx + 1, by - 1);
          c2.closePath(); c2.fill();
        }
      });
    });
  }
  return spritePlane('pu-reparatur', 192, 192, 1.9, 1.9, (ctx) => {
    drawToken(ctx, 'rgba(62,207,106,ALPHA)', (c2, c) => {
      // Schraubenschlüssel
      c2.strokeStyle = '#b9f5c9'; c2.lineWidth = 13; c2.lineCap = 'round';
      c2.beginPath(); c2.moveTo(c - 16, c + 18); c2.lineTo(c + 10, c - 8); c2.stroke();
      c2.fillStyle = '#b9f5c9';
      c2.beginPath(); c2.arc(c + 18, c - 16, 15, 0, Math.PI * 2); c2.fill();
      c2.fillStyle = 'rgba(16,26,56,0.92)';
      c2.beginPath(); c2.arc(c + 26, c - 24, 10, 0, Math.PI * 2); c2.fill();
    });
  });
}

export class PowerUpSystem {
  constructor(scene) {
    this.scene = scene;
    this.items = [];
    this.spawnTimer = 18; // erstes Power-up kommt etwas früher
  }

  reset() {
    for (const p of this.items) this.scene.remove(p.group);
    this.items = [];
    this.spawnTimer = 18;
  }

  update(dt, time) {
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = SPAWN_MIN + Math.random() * (SPAWN_MAX - SPAWN_MIN);
      this.spawn();
    }
    for (let i = this.items.length - 1; i >= 0; i--) {
      const p = this.items[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.scene.remove(p.group);
        this.items.splice(i, 1);
        continue;
      }
      p.group.position.addScaledVector(p.drift, dt);
      p.group.position.y = p.baseY + Math.sin(time * 1.8 + p.phase) * 0.3;
      p.token.rotation.z = Math.sin(time * 1.5 + p.phase) * 0.25;
      const pulse = 1 + Math.sin(time * 3.2 + p.phase) * 0.08;
      p.token.scale.setScalar(pulse);
      // Verglühen ankündigen
      const blink = p.life < 3 ? (Math.sin(time * 12) > 0 ? 1 : 0.3) : 1;
      p.token.material.opacity = blink;
    }
  }

  spawn() {
    const roll = Math.random() * 13;
    const type = roll < 4 ? 'ueberladung' : roll < 7 ? 'emp' : roll < 10 ? 'reparatur' : 'magnet';
    const lane = Math.floor(Math.random() * LANES);
    const col = 1 + Math.floor(Math.random() * (COLS - 2));

    const group = new THREE.Group();
    group.quaternion.copy(spriteQuaternion());
    const token = tokenPlane(type);
    group.add(token);
    group.position.set(colX(col), 2.0, laneZ(lane));
    this.scene.add(group);
    this.items.push({
      group, token, type,
      drift: new THREE.Vector3((Math.random() - 0.5) * 0.4, 0, (Math.random() - 0.5) * 0.25),
      life: LIFETIME,
      baseY: 2.0,
      phase: Math.random() * Math.PI * 2,
    });
  }

  // Klick-Prüfung; gibt { type, position } zurück oder null
  tryCollect(raycaster) {
    for (let i = 0; i < this.items.length; i++) {
      const p = this.items[i];
      const hits = raycaster.intersectObject(p.group, true);
      if (hits.length > 0) {
        const pos = p.group.position.clone();
        this.scene.remove(p.group);
        this.items.splice(i, 1);
        return { type: p.type, position: pos };
      }
    }
    return null;
  }
}
