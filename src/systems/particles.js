// Cartoon-Partikelsystem: bunte Kreise, Funkelsterne und Ring-Schockwellen
// als THREE.Sprite (immer kamerazugewandt). API unverändert.

import * as THREE from 'three';
import { getTexture } from '../entities/meshFactory.js';

function circleTex() {
  return getTexture('p-circle', 64, 64, (ctx) => {
    const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.55, 'rgba(255,255,255,0.9)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(32, 32, 30, 0, Math.PI * 2); ctx.fill();
  });
}

function starTex() {
  return getTexture('p-star', 64, 64, (ctx) => {
    ctx.translate(32, 32);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      ctx.rotate(Math.PI / 2);
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(5, -5, 0, -30);
      ctx.quadraticCurveTo(-5, -5, 0, 0);
    }
    ctx.fill();
  });
}

function chunkTex() {
  return getTexture('p-chunk', 64, 64, (ctx) => {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(32, 6); ctx.lineTo(56, 26); ctx.lineTo(46, 56); ctx.lineTo(14, 50); ctx.lineTo(8, 22);
    ctx.closePath(); ctx.fill();
  });
}

function ringTex() {
  return getTexture('p-ring', 96, 96, (ctx) => {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 8;
    ctx.beginPath(); ctx.arc(48, 48, 38, 0, Math.PI * 2); ctx.stroke();
  });
}

export class ParticleSystem {
  constructor(scene) {
    this.scene = scene;
    this.particles = [];
  }

  spawnSprite(tex, color, additive, pos) {
    const mat = new THREE.SpriteMaterial({
      map: tex,
      color,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    const s = new THREE.Sprite(mat);
    s.position.copy(pos);
    this.scene.add(s);
    return s;
  }

  burst(pos, { count = 10, colors, tex, additive = true, speed = 5, life = 0.7, size = 0.5, up = 0.6 }) {
    for (let i = 0; i < count; i++) {
      const sprite = this.spawnSprite(tex, colors[i % colors.length], additive, pos);
      const sz = size * (0.6 + Math.random() * 0.8);
      sprite.scale.setScalar(sz);
      sprite.material.rotation = Math.random() * Math.PI * 2;
      const vel = new THREE.Vector3(
        Math.random() - 0.5,
        Math.random() * up,
        Math.random() - 0.5
      ).normalize().multiplyScalar(speed * (0.5 + Math.random() * 0.8));
      this.particles.push({
        sprite, vel,
        life: life * (0.7 + Math.random() * 0.6),
        maxLife: life,
        spin: (Math.random() - 0.5) * 10,
        baseSize: sz,
      });
    }
  }

  // Ring-Schockwelle
  shockwave(pos, color, maxScale = 4) {
    const sprite = this.spawnSprite(ringTex(), color, true, pos);
    sprite.scale.setScalar(0.4);
    this.particles.push({
      sprite, vel: new THREE.Vector3(),
      life: 0.4, maxLife: 0.4, grow: maxScale, baseSize: 0.4,
    });
  }

  // Bruchstück-Explosion (Asteroiden/Schrott): Brocken + Staub + Funken
  burstRock(pos, count = 10) {
    this.burst(pos, {
      count, tex: chunkTex(), additive: false,
      colors: [0x8d7c62, 0xa9906c, 0x6d6552], speed: 5, life: 0.8, size: 0.55,
    });
    this.burst(pos, {
      count: 4, tex: circleTex(), additive: false,
      colors: [0xcbb894], speed: 2.5, life: 0.9, size: 0.9,
    });
    this.burst(pos, {
      count: 4, tex: starTex(), additive: true,
      colors: [0xffe082], speed: 7, life: 0.4, size: 0.5,
    });
  }

  // Energie-Blitz + Auflösung (Aliens)
  burstAlien(pos, count = 14) {
    this.burst(pos, {
      count, tex: starTex(), additive: true,
      colors: [0xff4dd2, 0xc26bd6, 0xaefc4b], speed: 7, life: 0.55, size: 0.7,
    });
    this.burst(pos, {
      count: Math.floor(count / 2), tex: circleTex(), additive: true,
      colors: [0xaefc4b, 0xffffff], speed: 4, life: 0.4, size: 0.5,
    });
    this.shockwave(pos, 0xff4dd2, 4.5);
    this.flash(pos, 0xffffff);
  }

  // Sammel-Funkeln beim Kristall-Einsammeln
  burstCrystal(pos) {
    this.burst(pos, {
      count: 9, tex: starTex(), additive: true,
      colors: [0x40e0ff, 0xffffff, 0x7df3ff], speed: 5, life: 0.5, size: 0.6,
    });
    this.shockwave(pos, 0x40e0ff, 3);
  }

  // Einschlags-Funken
  burstImpact(pos, color = 0x40e0ff) {
    this.burst(pos, {
      count: 6, tex: starTex(), additive: true,
      colors: [color, 0xffffff], speed: 4, life: 0.3, size: 0.45,
    });
  }

  // Sieges-Feuerwerk: bunter Sternenregen + Schockring + Blitz
  firework(pos) {
    const palettes = [
      [0xffd23f, 0xfff3b0, 0xff8a5c],
      [0x40e0ff, 0x7df3ff, 0xffffff],
      [0xff4dd2, 0xffb1ec, 0xc26bd6],
      [0xaefc4b, 0x3ecf6a, 0xd3ff9a],
    ];
    const colors = palettes[Math.floor(Math.random() * palettes.length)];
    this.burst(pos, {
      count: 22, tex: starTex(), additive: true,
      colors, speed: 8, life: 0.9, size: 0.65, up: 1.4,
    });
    this.burst(pos, {
      count: 8, tex: circleTex(), additive: true,
      colors: [colors[0], 0xffffff], speed: 4, life: 0.6, size: 0.5, up: 1.2,
    });
    this.shockwave(pos, colors[0], 5);
    this.flash(pos, 0xffffff);
  }

  // kurzer heller Blitz
  flash(pos, color) {
    const sprite = this.spawnSprite(circleTex(), color, true, pos);
    sprite.scale.setScalar(0.8);
    this.particles.push({
      sprite, vel: new THREE.Vector3(),
      life: 0.22, maxLife: 0.22, grow: 9, baseSize: 0.8,
    });
  }

  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.scene.remove(p.sprite);
        p.sprite.material.dispose();
        this.particles.splice(i, 1);
        continue;
      }
      const t = p.life / p.maxLife;
      p.sprite.position.addScaledVector(p.vel, dt);
      p.sprite.material.opacity = t;
      if (p.grow) {
        p.sprite.scale.addScalar(p.grow * dt);
      } else {
        p.sprite.scale.setScalar(p.baseSize * (0.3 + t * 0.7));
        p.sprite.material.rotation += (p.spin ?? 0) * dt;
      }
    }
  }
}
