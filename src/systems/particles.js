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
    this.lines = [];
  }

  // leuchtender Strahl/Bogen zwischen zwei Punkten (Kettenblitz, Railkanone)
  arc(from, to, color = 0x9be8ff, life = 0.18, radius = 0.09) {
    const dir = to.clone().sub(from);
    const len = dir.length();
    if (len < 0.01) return;
    const geo = new THREE.CylinderGeometry(radius, radius, len, 6, 1, true);
    const mat = new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(from).addScaledVector(dir, 0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    this.scene.add(mesh);
    this.lines.push({ mesh, life, maxLife: life });
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

  // kleiner Mündungsblitz beim Abfeuern
  muzzle(pos, color = 0x7df3ff) {
    this.burst(pos, {
      count: 2, tex: starTex(), additive: true,
      colors: [color, 0xffffff], speed: 2, life: 0.16, size: 0.55,
    });
  }

  // Orbitalschlag-Aufladung: dünner roter Zielstrahl vom Himmel
  preBeam(pos, duration = 1.2) {
    const sprite = this.spawnSprite(circleTex(), 0xff4050, true, pos.clone().add(new THREE.Vector3(0, 5.5, 0)));
    sprite.scale.set(0.35, 12, 1);
    sprite.material.opacity = 0.5;
    this.particles.push({
      sprite, vel: new THREE.Vector3(),
      life: duration, maxLife: duration, stretch: true, baseSize: 1,
    });
  }

  // rote Energie-Funken, die zur Aufladung ins Ziel stürzen
  chargeSpark(pos) {
    for (let i = 0; i < 3; i++) {
      const a = Math.random() * Math.PI * 2;
      const off = new THREE.Vector3(Math.cos(a) * 2.4, Math.random() * 2.2, Math.sin(a) * 2.4);
      const sprite = this.spawnSprite(starTex(), i % 2 ? 0xff4050 : 0xffb0a0, true, pos.clone().add(off));
      sprite.scale.setScalar(0.45);
      this.particles.push({
        sprite, vel: off.clone().multiplyScalar(-5),
        life: 0.4, maxLife: 0.4, spin: 7, baseSize: 0.45,
      });
    }
  }

  // Orbitalschlag: senkrechter Lichtstrahl + Einschlag
  beam(pos, color = 0xbff3ff) {
    const sprite = this.spawnSprite(circleTex(), color, true, pos.clone().add(new THREE.Vector3(0, 5.5, 0)));
    sprite.scale.set(1.6, 12, 1);
    this.particles.push({
      sprite, vel: new THREE.Vector3(),
      life: 0.45, maxLife: 0.45, stretch: true, baseSize: 1,
    });
    this.flash(pos, 0xffffff);
    this.shockwave(pos, color, 6);
    this.burst(pos, {
      count: 14, tex: starTex(), additive: true,
      colors: [color, 0xffffff, 0xffd23f], speed: 8, life: 0.6, size: 0.6, up: 1.6,
    });
  }

  // Implosion (Phasenspringer): Funken stürzen nach innen
  implode(pos, color = 0xc26bd6) {
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const off = new THREE.Vector3(Math.cos(a) * 1.7, (Math.random() - 0.3) * 1.4, Math.sin(a) * 1.7);
      const sprite = this.spawnSprite(starTex(), i % 2 ? color : 0x7df3ff, true, pos.clone().add(off));
      sprite.scale.setScalar(0.5);
      this.particles.push({
        sprite, vel: off.clone().multiplyScalar(-4.5),
        life: 0.32, maxLife: 0.32, spin: 8, baseSize: 0.5,
      });
    }
    this.flash(pos, 0xffffff);
  }

  // Panzerwalze: zerbricht in schwere Panzerplatten
  armorBurst(pos) {
    this.burst(pos, {
      count: 8, tex: chunkTex(), additive: false,
      colors: [0x6a3691, 0x3a4258, 0x535e7c], speed: 5, life: 1.0, size: 0.85,
    });
    this.burst(pos, {
      count: 6, tex: starTex(), additive: true,
      colors: [0xaefc4b, 0xc26bd6], speed: 7, life: 0.4, size: 0.55,
    });
    this.shockwave(pos, 0x8e5bb0, 4.5);
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
      if (p.stretch) {
        // nicht-uniforme Sprites (z. B. Orbital-Strahl): nur ausblenden
      } else if (p.grow) {
        p.sprite.scale.addScalar(p.grow * dt);
      } else {
        p.sprite.scale.setScalar(p.baseSize * (0.3 + t * 0.7));
        p.sprite.material.rotation += (p.spin ?? 0) * dt;
      }
    }
    // Strahl-/Bogen-Effekte ausblenden
    for (let i = this.lines.length - 1; i >= 0; i--) {
      const l = this.lines[i];
      l.life -= dt;
      if (l.life <= 0) {
        this.scene.remove(l.mesh);
        l.mesh.geometry.dispose();
        l.mesh.material.dispose();
        this.lines.splice(i, 1);
      } else {
        l.mesh.material.opacity = (l.life / l.maxLife) * 0.95;
      }
    }
  }
}
