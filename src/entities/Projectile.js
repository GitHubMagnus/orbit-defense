// Sichtbar fliegende Cartoon-Projektile (kein Instant-Hit) mit Leucht-Trail.
// Als THREE.Sprite — immer kamerazugewandt, satte Glow-Farben.

import * as THREE from 'three';
import { getTexture } from './meshFactory.js';

const PROJECTILE_DEFS = {
  laser:  { speed: 30, w: 1.5, h: 0.55, tex: 'proj-laser' },
  plasma: { speed: 13, w: 1.15, h: 1.15, tex: 'proj-plasma' },
  // Rakete ist ein festes Objekt: normales Blending, sonst verwäscht sie zum Leucht-Klecks
  rakete: { speed: 15, w: 2.1, h: 0.8, tex: 'proj-rakete', solid: true },
  frost:  { speed: 16, w: 0.85, h: 0.85, tex: 'proj-frost' },
  bolt:   { speed: 20, w: 0.75, h: 0.75, tex: 'proj-bolt' }, // Gegner-Schuss
};

function projTexture(kind) {
  if (kind === 'laser') {
    return getTexture('proj-laser', 128, 48, (ctx) => {
      // länglicher Bolzen: weißer Kern, cyan Rand
      const g = ctx.createLinearGradient(0, 0, 0, 48);
      g.addColorStop(0, 'rgba(64,224,255,0)');
      g.addColorStop(0.5, 'rgba(64,224,255,0.9)');
      g.addColorStop(1, 'rgba(64,224,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(10, 24);
      ctx.quadraticCurveTo(24, 2, 74, 6); ctx.quadraticCurveTo(122, 14, 122, 24);
      ctx.quadraticCurveTo(122, 34, 74, 42); ctx.quadraticCurveTo(24, 46, 10, 24);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.ellipse(80, 24, 36, 8, 0, 0, Math.PI * 2); ctx.fill();
    });
  }
  if (kind === 'plasma') {
    return getTexture('proj-plasma', 96, 96, (ctx) => {
      const g = ctx.createRadialGradient(48, 48, 4, 48, 48, 44);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.4, '#ffb1ec');
      g.addColorStop(0.75, 'rgba(255,77,210,0.8)');
      g.addColorStop(1, 'rgba(255,77,210,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(48, 48, 44, 0, Math.PI * 2); ctx.fill();
      // kleine Energie-Wirbel
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(48, 48, 22, 0.3, 1.6); ctx.stroke();
      ctx.beginPath(); ctx.arc(48, 48, 26, 3.2, 4.4); ctx.stroke();
    });
  }
  if (kind === 'rakete') {
    return getTexture('proj-rakete', 192, 72, (ctx) => {
      ctx.strokeStyle = '#1b2447'; ctx.lineWidth = 6; ctx.lineJoin = 'round';
      // Flammen-Schweif links (klein, der Glow-Trail übernimmt den Rest)
      ctx.fillStyle = '#ffb300';
      ctx.beginPath();
      ctx.moveTo(14, 36);
      ctx.quadraticCurveTo(40, 20, 62, 24);
      ctx.lineTo(62, 48);
      ctx.quadraticCurveTo(40, 52, 14, 36);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff3b0';
      ctx.beginPath();
      ctx.moveTo(34, 36);
      ctx.quadraticCurveTo(48, 28, 62, 30);
      ctx.lineTo(62, 42);
      ctx.quadraticCurveTo(48, 44, 34, 36);
      ctx.closePath(); ctx.fill();
      // Heck-Finnen (oben/unten, orange)
      ctx.fillStyle = '#ff8a5c';
      ctx.beginPath(); ctx.moveTo(66, 22); ctx.lineTo(54, 6); ctx.lineTo(80, 20); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(66, 50); ctx.lineTo(54, 66); ctx.lineTo(80, 52); ctx.closePath(); ctx.fill(); ctx.stroke();
      // weißer Korpus
      ctx.fillStyle = '#f2f6ff';
      ctx.beginPath();
      ctx.moveTo(62, 20); ctx.lineTo(136, 20);
      ctx.quadraticCurveTo(150, 21, 152, 26);
      ctx.lineTo(152, 46);
      ctx.quadraticCurveTo(150, 51, 136, 52);
      ctx.lineTo(62, 52); ctx.closePath();
      ctx.fill(); ctx.stroke();
      // Bauchstreifen + Bullauge
      ctx.fillStyle = '#ff8a5c';
      ctx.fillRect(70, 20, 10, 32);
      ctx.strokeRect(70, 20, 10, 32);
      ctx.fillStyle = '#40e0ff';
      ctx.beginPath(); ctx.arc(112, 36, 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath(); ctx.arc(109, 33, 3, 0, Math.PI * 2); ctx.fill();
      // rote Spitze
      ctx.fillStyle = '#ff5252';
      ctx.beginPath();
      ctx.moveTo(150, 22);
      ctx.quadraticCurveTo(186, 32, 186, 36);
      ctx.quadraticCurveTo(186, 40, 150, 50);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      // Glanzlinie auf dem Korpus
      ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(84, 27); ctx.lineTo(134, 27); ctx.stroke();
    });
  }
  if (kind === 'frost') {
    return getTexture('proj-frost', 64, 64, (ctx) => {
      // eisiger Kristall-Schneeflocken-Bolzen
      const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.5, '#b3f0ff');
      g.addColorStop(1, 'rgba(120,220,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(32, 32, 30, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#eaffff'; ctx.lineWidth = 4; ctx.lineCap = 'round';
      for (let i = 0; i < 3; i++) {
        ctx.save(); ctx.translate(32, 32); ctx.rotate(i * Math.PI / 3);
        ctx.beginPath(); ctx.moveTo(-18, 0); ctx.lineTo(18, 0); ctx.stroke();
        ctx.restore();
      }
    });
  }
  if (kind === 'rakete-trail') {
    return getTexture('proj-rakete-trail', 64, 64, (ctx) => {
      const g = ctx.createRadialGradient(32, 32, 3, 32, 32, 30);
      g.addColorStop(0, '#fff3b0');
      g.addColorStop(0.45, 'rgba(255,170,60,0.85)');
      g.addColorStop(1, 'rgba(255,110,40,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(32, 32, 30, 0, Math.PI * 2); ctx.fill();
    });
  }
  return getTexture('proj-bolt', 64, 64, (ctx) => {
    const g = ctx.createRadialGradient(32, 32, 3, 32, 32, 30);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.45, '#d3ff9a');
    g.addColorStop(0.8, 'rgba(174,252,75,0.8)');
    g.addColorStop(1, 'rgba(174,252,75,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(32, 32, 30, 0, Math.PI * 2); ctx.fill();
  });
}

function makeSprite(kind, opacity = 1, solid = false) {
  const mat = new THREE.SpriteMaterial({
    map: projTexture(kind),
    transparent: true,
    opacity,
    depthWrite: false,
    blending: solid ? THREE.NormalBlending : THREE.AdditiveBlending,
  });
  return new THREE.Sprite(mat);
}

export class Projectile {
  constructor(kind, from, target, damage, opts = {}) {
    const def = PROJECTILE_DEFS[kind];
    this.kind = kind;
    this.def = def;
    this.target = target;       // Enemy oder Defender
    this.damage = damage;
    this.splash = opts.splash ?? 0; // Flächenschaden-Radius am Einschlag
    this.sourceId = opts.sourceId ?? null; // für die Schadens-Statistik
    this.frost = opts.frost ?? null; // Kryo-Turm: verlangsamt beim Treffer
    this.dead = false;

    this.mesh = makeSprite(kind, 1, def.solid);
    this.mesh.scale.set(def.w, def.h, 1);
    this.mesh.position.copy(from);

    // Leucht-Trail: bei der Rakete ein Abgas-Glühen, sonst verblassende Kopie
    if (kind === 'rakete') {
      this.trail = makeSprite('rakete-trail', 0.8);
      this.trail.scale.set(0.75, 0.75, 1);
    } else {
      this.trail = makeSprite(kind, 0.35);
      this.trail.scale.set(def.w * 1.5, def.h * 1.5, 1);
    }
    this.trail.position.copy(from);
  }

  addTo(scene) {
    scene.add(this.mesh);
    scene.add(this.trail);
  }

  removeFrom(scene) {
    scene.remove(this.mesh);
    scene.remove(this.trail);
  }

  targetPoint() {
    // auf Körpermitte zielen
    return this.target.position.clone().add(new THREE.Vector3(0, 1.4, 0));
  }

  update(dt) {
    if (this.target.dead) {
      this.dead = true;
      return null;
    }
    const to = this.targetPoint().sub(this.mesh.position);
    const dist = to.length();
    const step = this.def.speed * dt;
    if (dist <= step + 0.3) {
      this.dead = true;
      return this.target; // Treffer
    }
    to.normalize();
    // Trail hinkt hinterher
    this.trail.position.copy(this.mesh.position).addScaledVector(to, -0.6);
    this.mesh.position.addScaledVector(to, step);
    // Laser/Rakete entlang der Flugrichtung neigen (Screen-Space-Rotation)
    if (this.kind === 'laser' || this.kind === 'rakete') {
      const angle = Math.atan2(-to.z * 0.35 - to.y * 0.6, Math.abs(to.x));
      this.mesh.material.rotation = to.x >= 0 ? angle : Math.PI - angle;
      this.trail.material.rotation = this.mesh.material.rotation;
    }
    return null;
  }
}
