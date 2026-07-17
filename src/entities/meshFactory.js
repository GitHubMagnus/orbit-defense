// 2D-Cartoon-Sprite-Fabrik im Plants-vs-Zombies-Stil.
// Alle Einheiten/Gegner sind handgezeichnete Canvas-Sprites auf kamerazugewandten
// Planes, mit Gesichtern, dicken Outlines und Ballon-Animationen (Squash & Stretch).
// Die API bleibt identisch: buildDefenderMesh/buildEnemyMesh -> { group, animate(dt, time) }.

import * as THREE from 'three';

// ------------------------------------------------------------
// Kamera-Ausrichtung: alle Sprites schauen zur (fixen) Kamera
// ------------------------------------------------------------
const SPRITE_QUAT = new THREE.Quaternion();
export function setSpriteCamera(camera) {
  camera.updateMatrixWorld(true);
  SPRITE_QUAT.copy(camera.quaternion);
}
export function spriteQuaternion() {
  return SPRITE_QUAT;
}

// ------------------------------------------------------------
// Canvas-/Textur-Helfer (Texturen werden pro Motiv gecacht,
// Materialien sind pro Instanz — Opacity-Animationen bleiben lokal)
// ------------------------------------------------------------
const texCache = new Map();

export function getTexture(key, w, h, draw) {
  if (!texCache.has(key)) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    texCache.set(key, t);
  }
  return texCache.get(key);
}

export function spritePlane(key, cw, ch, worldW, worldH, draw, opts = {}) {
  const tex = getTexture(key, cw, ch, draw);
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: opts.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
  if (opts.opacity !== undefined) mat.opacity = opts.opacity;
  return new THREE.Mesh(new THREE.PlaneGeometry(worldW, worldH), mat);
}

// Weicher Bodenschatten unter jeder Einheit
export function makeShadow(worldW) {
  const m = spritePlane('shadow', 128, 64, worldW, worldW * 0.42, (ctx) => {
    ctx.translate(64, 32);
    ctx.scale(1, 0.5);
    const g = ctx.createRadialGradient(0, 0, 4, 0, 0, 60);
    g.addColorStop(0, 'rgba(4,8,24,0.55)');
    g.addColorStop(1, 'rgba(4,8,24,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, 60, 0, Math.PI * 2);
    ctx.fill();
  });
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.03;
  m.renderOrder = -2; // Boden-Deko: unter allen Figuren, über den Randstreifen
  return m;
}

// kamerazugewandte Gruppe für die "Spielkarte" der Einheit
function makeCard() {
  const g = new THREE.Group();
  g.quaternion.copy(SPRITE_QUAT);
  return g;
}

// Rig: skalierte Untergruppe mit Bodenschatten + kamerazugewandter Karte.
// Über den Scale-Faktor werden die Figuren schön groß und pummelig (PvZ-Feeling),
// ohne dass die Squash-&-Stretch-Animation auf der Karte kollidiert.
function makeRig(g, scale, shadowW) {
  const sizer = new THREE.Group();
  sizer.scale.setScalar(scale);
  sizer.userData.baseScale = scale;
  g.add(sizer);
  sizer.add(makeShadow(shadowW));
  const card = makeCard();
  sizer.add(card);
  return card;
}

// ------------------------------------------------------------
// Gebäude-Extras: Beschädigungs-Overlays (2 Stufen) + Ausbau-Abzeichen
// ------------------------------------------------------------
function drawCracks1(ctx) {
  ctx.strokeStyle = 'rgba(18,22,48,0.9)';
  ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // zwei markante Risse mit Verästelung
  ctx.beginPath();
  ctx.moveTo(60, 70); ctx.lineTo(96, 104); ctx.lineTo(88, 132);
  ctx.moveTo(96, 104); ctx.lineTo(122, 112);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(196, 150); ctx.lineTo(168, 168); ctx.lineTo(176, 196);
  ctx.moveTo(168, 168); ctx.lineTo(146, 176);
  ctx.stroke();
  // abgeplatzte Ecke
  ctx.fillStyle = 'rgba(18,22,48,0.7)';
  ctx.beginPath();
  ctx.moveTo(150, 62); ctx.lineTo(170, 58); ctx.lineTo(160, 76);
  ctx.closePath(); ctx.fill();
}

function drawCracks2(ctx) {
  drawCracks1(ctx);
  ctx.strokeStyle = 'rgba(18,22,48,0.95)';
  ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(128, 40); ctx.lineTo(118, 84); ctx.lineTo(138, 120); ctx.lineTo(126, 160);
  ctx.moveTo(118, 84) ; ctx.lineTo(96, 92);
  ctx.moveTo(138, 120); ctx.lineTo(164, 128);
  ctx.stroke();
  // Brandflecken
  for (const [sx, sy, sr] of [[92, 168, 30], [180, 96, 24]]) {
    const g = ctx.createRadialGradient(sx, sy, 4, sx, sy, sr);
    g.addColorStop(0, 'rgba(25,15,25,0.75)');
    g.addColorStop(1, 'rgba(25,15,25,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fill();
  }
  // glimmende Funken
  ctx.fillStyle = '#ffb300';
  for (const [fx, fy] of [[100, 160], [174, 104], [132, 128]]) {
    ctx.beginPath(); ctx.arc(fx, fy, 4, 0, Math.PI * 2); ctx.fill();
  }
}

function drawChevron(ctx) {
  ctx.fillStyle = '#ffd23f';
  ctx.strokeStyle = '#7a4d00';
  ctx.lineWidth = 7; ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(14, 64); ctx.lineTo(48, 24); ctx.lineTo(82, 64);
  ctx.lineTo(66, 76); ctx.lineTo(48, 52); ctx.lineTo(30, 76);
  ctx.closePath(); ctx.fill(); ctx.stroke();
}

// Hängt Beschädigungs-Overlays und die Ausbau-Optik an die Karte eines Gebäudes.
// Ausbauten verändern das Modell sichtbar: das Gebäude wächst, bekommt ab
// Stufe 2 eine goldene Energie-Plattform und ab Stufe 3 eine leuchtende Aura.
// Liefert { setDamage(stufe 0-2), setLevel(1-3) } für die Defender-Klasse.
function attachDefenderExtras(card, size, y) {
  const d1 = spritePlane('def-damage-1', 256, 256, size, size, drawCracks1);
  d1.position.set(0, y, 0.12);
  d1.visible = false;
  card.add(d1);
  const d2 = spritePlane('def-damage-2', 256, 256, size, size, drawCracks2);
  d2.position.set(0, y, 0.13);
  d2.visible = false;
  card.add(d2);

  const chevrons = [];
  for (let i = 0; i < 2; i++) {
    const c = spritePlane('lvl-chevron', 96, 96, 0.62, 0.62, drawChevron);
    c.position.set(-0.34 + i * 0.68, y + size / 2 + 0.28, 0.14);
    c.visible = false;
    card.add(c);
    chevrons.push(c);
  }

  // goldene Plattform (flach am Boden, ab Stufe 2)
  const sizer = card.parent;
  const platform = spritePlane('lvl-platform', 192, 192, size * 1.15, size * 1.15, (ctx) => {
    ctx.strokeStyle = '#ffd23f';
    ctx.lineWidth = 9; ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let i = 0; i <= 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
      const x = 96 + Math.cos(a) * 80, yy = 96 + Math.sin(a) * 80;
      i === 0 ? ctx.moveTo(x, yy) : ctx.lineTo(x, yy);
    }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,210,63,0.45)';
    ctx.lineWidth = 20;
    ctx.beginPath();
    for (let i = 0; i <= 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
      const x = 96 + Math.cos(a) * 66, yy = 96 + Math.sin(a) * 66;
      i === 0 ? ctx.moveTo(x, yy) : ctx.lineTo(x, yy);
    }
    ctx.stroke();
    // Energie-Kerben
    ctx.fillStyle = '#fff3b0';
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(96 + Math.cos(a) * 80, 96 + Math.sin(a) * 80, 7, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  platform.rotation.x = -Math.PI / 2;
  platform.position.y = 0.05;
  platform.renderOrder = -1;
  platform.visible = false;
  sizer.add(platform);

  // Energie-Aura hinter dem Gebäude (Stufe 3)
  const aura = spritePlane('lvl-aura', 160, 160, size * 1.25, size * 1.25, (ctx) => {
    const g = ctx.createRadialGradient(80, 80, 20, 80, 80, 78);
    g.addColorStop(0, 'rgba(255,222,120,0.0)');
    g.addColorStop(0.7, 'rgba(255,210,63,0.28)');
    g.addColorStop(1, 'rgba(255,190,50,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(80, 80, 78, 0, Math.PI * 2); ctx.fill();
  }, { additive: true });
  aura.position.set(0, y, -0.06);
  aura.visible = false;
  card.add(aura);

  return {
    setDamage(stage) {
      d1.visible = stage >= 1;
      d2.visible = stage >= 2;
    },
    setLevel(level) {
      chevrons[0].visible = level >= 2;
      chevrons[1].visible = level >= 3;
      platform.visible = level >= 2;
      aura.visible = level >= 3;
      // das Gebäude wächst sichtbar mit jeder Stufe
      const base = sizer.userData.baseScale ?? 1;
      sizer.scale.setScalar(base * (1 + 0.07 * (level - 1)));
    },
  };
}

// ------------------------------------------------------------
// Zeichen-Utilities (Cartoon-Stil)
// ------------------------------------------------------------
const OUTLINE = '#1b2447';

function o(ctx, w = 9) {
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = w;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
}

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function lgrad(ctx, x0, y0, x1, y1, stops) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  for (const [p, c] of stops) g.addColorStop(p, c);
  return g;
}

function rgrad(ctx, x, y, r0, r1, stops) {
  const g = ctx.createRadialGradient(x, y, r0, x, y, r1);
  for (const [p, c] of stops) g.addColorStop(p, c);
  return g;
}

// freundliches Auge
function eye(ctx, x, y, r, lookX = 0.25, lookY = 0.1) {
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  o(ctx, r * 0.35); ctx.stroke();
  ctx.fillStyle = OUTLINE;
  ctx.beginPath(); ctx.arc(x + lookX * r, y + lookY * r, r * 0.45, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(x + lookX * r - r * 0.12, y + lookY * r - r * 0.16, r * 0.16, 0, Math.PI * 2); ctx.fill();
}

// böses Auge mit Braue
function angryEye(ctx, x, y, r, dir = -1, color = '#aefc4b') {
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  o(ctx, r * 0.35); ctx.stroke();
  ctx.fillStyle = OUTLINE;
  ctx.beginPath(); ctx.arc(x + dir * r * 0.2, y + r * 0.1, r * 0.4, 0, Math.PI * 2); ctx.fill();
  // Braue
  ctx.beginPath();
  ctx.moveTo(x - r * 1.1, y - r * (dir < 0 ? 1.2 : 0.6));
  ctx.lineTo(x + r * 1.1, y - r * (dir < 0 ? 0.6 : 1.2));
  o(ctx, r * 0.5); ctx.stroke();
}

function smile(ctx, x, y, r, open = false) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0.15 * Math.PI, 0.85 * Math.PI);
  o(ctx, 7); ctx.stroke();
  if (open) {
    ctx.fillStyle = OUTLINE;
    ctx.beginPath(); ctx.arc(x, y + r * 0.35, r * 0.5, 0, Math.PI * 2); ctx.fill();
  }
}

function blush(ctx, x, y, r) {
  ctx.fillStyle = 'rgba(255,120,150,0.45)';
  ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.6, 0, 0, Math.PI * 2); ctx.fill();
}

// weiche Leucht-Scheibe (für Glows, additiv)
function glowDisc(key, color, worldSize) {
  return spritePlane(`glow-${key}`, 128, 128, worldSize, worldSize, (ctx) => {
    const g = rgrad(ctx, 64, 64, 4, 62, [
      [0, '#ffffff'], [0.25, color], [1, 'rgba(0,0,0,0)'],
    ]);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(64, 64, 62, 0, Math.PI * 2); ctx.fill();
  }, { additive: true });
}

// Elite-Gegner: pulsierende gold-rote Aura (Markierung für verstärkte Varianten)
export function makeEliteAura(size = 3.2) {
  const m = spritePlane('elite-aura', 160, 160, size, size, (ctx) => {
    const g = rgrad(ctx, 80, 80, 24, 78, [
      [0, 'rgba(255,120,50,0)'],
      [0.65, 'rgba(255,160,50,0.4)'],
      [0.88, 'rgba(255,210,63,0.75)'],
      [1, 'rgba(255,160,50,0)'],
    ]);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(80, 80, 78, 0, Math.PI * 2); ctx.fill();
    // kleine Zacken-Krone oben
    ctx.fillStyle = '#ffd23f';
    ctx.strokeStyle = '#7a4d00'; ctx.lineWidth = 4; ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(56, 34); ctx.lineTo(62, 16) ; ctx.lineTo(72, 30);
    ctx.lineTo(80, 12); ctx.lineTo(88, 30); ctx.lineTo(98, 16); ctx.lineTo(104, 34);
    ctx.closePath(); ctx.fill(); ctx.stroke();
  }, { additive: true });
  return m;
}

// weißer Treffer-Blitz (kurz eingeblendet, wenn ein Gegner Schaden nimmt)
export function makeHitFlash(size = 2.4) {
  const m = spritePlane('hit-flash', 128, 128, size, size, (ctx) => {
    const g = rgrad(ctx, 64, 64, 6, 60, [
      [0, 'rgba(255,255,255,0.95)'],
      [0.5, 'rgba(255,255,255,0.55)'],
      [1, 'rgba(255,255,255,0)'],
    ]);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(64, 64, 60, 0, Math.PI * 2); ctx.fill();
  }, { additive: true });
  m.visible = false;
  return m;
}

// 4-Zack-Funkelstern
function sparklePlane(key, color, worldSize) {
  return spritePlane(`spark-${key}`, 96, 96, worldSize, worldSize, (ctx) => {
    ctx.translate(48, 48);
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      ctx.rotate(Math.PI / 2);
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(6, -6, 0, -42);
      ctx.quadraticCurveTo(-6, -6, 0, 0);
    }
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill();
  }, { additive: true });
}

// ============================================================
// Verteidiger
// ============================================================

export function buildDefenderMesh(typeId) {
  switch (typeId) {
    case 'laserturm': return buildLaserturm();
    case 'plasmakanone': return buildPlasmakanone();
    case 'schildgenerator': return buildSchildgenerator();
    case 'solarkollektor': return buildSolarkollektor();
    case 'traktorstrahl': return buildTraktorstrahl();
    case 'ionenpuls': return buildIonenpuls();
    case 'raketenwerfer': return buildRaketenwerfer();
    case 'reparaturdrohne': return buildReparaturdrohne();
    default: throw new Error(`Unbekannter Verteidiger-Typ: ${typeId}`);
  }
}

// --- Laserturm: Cyan-Geschütz mit Scanner-Visier und Kanone nach rechts ---
function buildLaserturm() {
  const g = new THREE.Group();
  const card = makeRig(g, 1.25, 3.0);

  const body = spritePlane('def-laser2', 256, 256, 3.4, 3.4, (ctx) => {
    // Standfuß
    ctx.fillStyle = lgrad(ctx, 0, 190, 0, 246, [[0, '#3d5a80'], [1, '#27395c']]);
    rr(ctx, 62, 192, 132, 52, 18); ctx.fill(); o(ctx); ctx.stroke();
    ctx.fillStyle = 'rgba(120,220,255,0.5)';
    rr(ctx, 82, 204, 92, 10, 5); ctx.fill();
    // Säule
    ctx.fillStyle = lgrad(ctx, 0, 120, 0, 200, [[0, '#8fd8ea'], [1, '#4a7fa8']]);
    rr(ctx, 96, 130, 64, 72, 14); ctx.fill(); o(ctx); ctx.stroke();
    // Kanone nach rechts
    ctx.fillStyle = lgrad(ctx, 150, 0, 246, 0, [[0, '#5e93b8'], [1, '#38648f']]);
    rr(ctx, 148, 86, 96, 40, 16); ctx.fill(); o(ctx); ctx.stroke();
    ctx.fillStyle = '#bff3ff';
    rr(ctx, 156, 92, 60, 10, 5); ctx.fill();
    // Mündungsring
    ctx.fillStyle = '#eaffff';
    rr(ctx, 228, 80, 18, 52, 8); ctx.fill(); o(ctx); ctx.stroke();
    // Kopf-Dom
    ctx.fillStyle = rgrad(ctx, 110, 84, 8, 70, [[0, '#d9fbff'], [0.55, '#6fe0f7'], [1, '#2fa3c9']]);
    ctx.beginPath(); ctx.arc(118, 96, 58, 0, Math.PI * 2); ctx.fill(); o(ctx); ctx.stroke();
    // Scanner-Visier (Leuchtband statt Gesicht)
    ctx.fillStyle = '#173056';
    rr(ctx, 76, 80, 84, 34, 17); ctx.fill(); o(ctx, 7); ctx.stroke();
    ctx.fillStyle = '#40e0ff';
    rr(ctx, 86, 90, 64, 14, 7); ctx.fill();
    ctx.fillStyle = '#eaffff';
    rr(ctx, 122, 92, 16, 10, 5); ctx.fill();
    // Antenne
    ctx.beginPath(); ctx.moveTo(96, 46); ctx.lineTo(104, 64); o(ctx, 7); ctx.stroke();
    ctx.fillStyle = '#ffd54f';
    ctx.beginPath(); ctx.arc(94, 40, 9, 0, Math.PI * 2); ctx.fill(); o(ctx, 5); ctx.stroke();
    // Kühlrippen an der Säule
    ctx.strokeStyle = 'rgba(20,40,80,0.45)'; ctx.lineWidth = 4;
    for (const ry of [148, 162, 176]) {
      ctx.beginPath(); ctx.moveTo(102, ry); ctx.lineTo(154, ry); ctx.stroke();
    }
    // Glanzlicht
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath(); ctx.ellipse(94, 64, 16, 9, -0.6, 0, Math.PI * 2); ctx.fill();
  });
  body.position.y = 1.7;
  card.add(body);

  const tip = glowDisc('cyan', 'rgba(64,224,255,0.9)', 1.1);
  tip.position.set(1.55, 1.85, 0.06);
  card.add(tip);

  const extras = attachDefenderExtras(card, 3.1, 1.7);
  g.userData.muzzleOffset = new THREE.Vector3(1.9, 2.3, 0);
  const phase = Math.random() * Math.PI * 2;

  return {
    group: g,
    ...extras,
    animate(dt, time) {
      const s = Math.sin(time * 2.6 + phase) * 0.03;
      card.scale.set(1 + s, 1 - s, 1);
      tip.material.opacity = 0.55 + Math.sin(time * 6 + phase) * 0.35;
      tip.scale.setScalar(1 + Math.sin(time * 6 + phase) * 0.15);
    },
  };
}

// --- Plasmakanone: pummelige Weiß-Magenta-Kanone mit Reaktor-Bullauge ---
function buildPlasmakanone() {
  const g = new THREE.Group();
  const card = makeRig(g, 1.25, 3.2);

  const body = spritePlane('def-plasma2', 256, 256, 3.6, 3.6, (ctx) => {
    // Fuß
    ctx.fillStyle = lgrad(ctx, 0, 196, 0, 248, [[0, '#5a6b93'], [1, '#38466b']]);
    rr(ctx, 58, 198, 140, 48, 18); ctx.fill(); o(ctx); ctx.stroke();
    // Rumpf: große runde Kanone
    ctx.fillStyle = rgrad(ctx, 100, 120, 20, 100, [[0, '#ffffff'], [0.5, '#f3e0fa'], [1, '#c58ad6']]);
    ctx.beginPath(); ctx.arc(112, 140, 84, 0, Math.PI * 2); ctx.fill(); o(ctx); ctx.stroke();
    // Magenta-Panel
    ctx.fillStyle = 'rgba(233,84,205,0.7)';
    ctx.beginPath(); ctx.arc(112, 140, 84, 0.55 * Math.PI, 0.98 * Math.PI); ctx.arc(112, 140, 48, 0.98 * Math.PI, 0.55 * Math.PI, true); ctx.closePath(); ctx.fill();
    // Lauf nach rechts
    ctx.fillStyle = lgrad(ctx, 160, 0, 250, 0, [[0, '#e6c7f2'], [1, '#a35ec2']]);
    rr(ctx, 168, 100, 82, 62, 24); ctx.fill(); o(ctx); ctx.stroke();
    ctx.fillStyle = '#2c1846';
    ctx.beginPath(); ctx.ellipse(244, 131, 12, 24, 0, 0, Math.PI * 2); ctx.fill(); o(ctx, 6); ctx.stroke();
    // Reaktor-Bullauge mit wirbelndem Plasma (statt Gesicht)
    ctx.fillStyle = '#2c1846';
    ctx.beginPath(); ctx.arc(106, 126, 34, 0, Math.PI * 2); ctx.fill(); o(ctx, 7); ctx.stroke();
    ctx.fillStyle = rgrad(ctx, 100, 120, 3, 30, [[0, '#ffffff'], [0.4, '#ff9be4'], [1, '#b03a94']]);
    ctx.beginPath(); ctx.arc(106, 126, 26, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(106, 126, 15, 0.4, 1.8); ctx.stroke();
    ctx.beginPath(); ctx.arc(106, 126, 19, 3.3, 4.6); ctx.stroke();
    // Rahmen-Schrauben am Bullauge
    ctx.fillStyle = '#8e5aa8';
    for (const a of [0.6, 2.2, 3.8, 5.4]) {
      ctx.beginPath(); ctx.arc(106 + Math.cos(a) * 33, 126 + Math.sin(a) * 33, 4.5, 0, Math.PI * 2); ctx.fill();
    }
    // Nieten am Rumpf
    ctx.fillStyle = '#8e5aa8';
    for (const [nx, ny] of [[62, 118], [74, 176], [140, 208]]) {
      ctx.beginPath(); ctx.arc(nx, ny, 7, 0, Math.PI * 2); ctx.fill();
    }
    // Glanz
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath(); ctx.ellipse(84, 82, 20, 11, -0.5, 0, Math.PI * 2); ctx.fill();
  });
  body.position.y = 1.8;
  card.add(body);

  const orb = glowDisc('magenta', 'rgba(255,77,210,0.95)', 1.5);
  orb.position.set(1.75, 1.85, 0.08);
  card.add(orb);

  const extras = attachDefenderExtras(card, 3.3, 1.8);
  g.userData.muzzleOffset = new THREE.Vector3(2.15, 2.3, 0);
  const phase = Math.random() * Math.PI * 2;

  return {
    group: g,
    ...extras,
    animate(dt, time) {
      const s = Math.sin(time * 1.9 + phase) * 0.035;
      card.scale.set(1 + s, 1 - s, 1);
      const charge = 0.65 + Math.sin(time * 2.2 + phase) * 0.35;
      orb.scale.setScalar(charge);
      orb.material.opacity = 0.4 + charge * 0.5;
    },
  };
}

// --- Schildgenerator: kleiner Roboter mit großer Energieblase ---
function buildSchildgenerator() {
  const g = new THREE.Group();
  const card = makeRig(g, 1.25, 3.2);

  const bot = spritePlane('def-schild2', 256, 256, 2.6, 2.6, (ctx) => {
    // Körper
    ctx.fillStyle = lgrad(ctx, 0, 90, 0, 240, [[0, '#9fe8f5'], [1, '#3f7fae']]);
    rr(ctx, 74, 96, 108, 118, 30); ctx.fill(); o(ctx); ctx.stroke();
    // Emitter-Gitter oben (statt Gesicht)
    ctx.fillStyle = '#173056';
    rr(ctx, 92, 112, 72, 30, 12); ctx.fill(); o(ctx, 6); ctx.stroke();
    ctx.strokeStyle = '#40e0ff'; ctx.lineWidth = 4;
    for (const gx of [104, 118, 132, 146]) {
      ctx.beginPath(); ctx.moveTo(gx, 118); ctx.lineTo(gx, 136); ctx.stroke();
    }
    // Bauch-Licht
    ctx.fillStyle = rgrad(ctx, 128, 176, 4, 30, [[0, '#ffffff'], [0.5, '#40e0ff'], [1, '#1d7fa8']]);
    ctx.beginPath(); ctx.arc(128, 176, 24, 0, Math.PI * 2); ctx.fill(); o(ctx, 6); ctx.stroke();
    // Status-LEDs
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = i === 2 ? '#aefc4b' : '#40e0ff';
      ctx.beginPath(); ctx.arc(104 + i * 24, 152, 6, 0, Math.PI * 2); ctx.fill();
      o(ctx, 4); ctx.stroke();
    }
    // Füßchen
    ctx.fillStyle = '#2d4b74';
    rr(ctx, 80, 208, 40, 26, 10); ctx.fill(); o(ctx, 6); ctx.stroke();
    rr(ctx, 136, 208, 40, 26, 10); ctx.fill(); o(ctx, 6); ctx.stroke();
    // Antenne mit Energie-Knauf
    ctx.beginPath(); ctx.moveTo(128, 96); ctx.lineTo(128, 66); o(ctx, 7); ctx.stroke();
    ctx.fillStyle = '#40e0ff';
    ctx.beginPath(); ctx.arc(128, 56, 12, 0, Math.PI * 2); ctx.fill(); o(ctx, 6); ctx.stroke();
    // Glanz
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath(); ctx.ellipse(98, 106, 12, 7, -0.5, 0, Math.PI * 2); ctx.fill();
  });
  bot.position.y = 1.2;
  card.add(bot);

  const bubble = spritePlane('def-schild-bubble', 256, 256, 3.9, 3.9, (ctx) => {
    // transluzente Blase mit hellem Rand
    ctx.fillStyle = rgrad(ctx, 128, 128, 30, 120, [
      [0, 'rgba(120,235,255,0.10)'], [0.75, 'rgba(80,215,255,0.22)'], [0.92, 'rgba(190,250,255,0.85)'], [1, 'rgba(120,235,255,0)'],
    ]);
    ctx.beginPath(); ctx.arc(128, 128, 120, 0, Math.PI * 2); ctx.fill();
    // Glanz-Bogen
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 9; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(128, 128, 96, 1.25 * Math.PI, 1.6 * Math.PI); ctx.stroke();
    // kleine Sechseck-Andeutungen
    ctx.strokeStyle = 'rgba(190,250,255,0.35)';
    ctx.lineWidth = 4;
    for (const [hx, hy] of [[80, 100], [170, 90], [150, 180], [70, 170]]) {
      ctx.beginPath();
      for (let i = 0; i <= 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const px = hx + Math.cos(a) * 16, py = hy + Math.sin(a) * 16;
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
  }, { additive: true });
  bubble.position.set(0, 1.8, 0.1);
  card.add(bubble);

  const extras = attachDefenderExtras(card, 2.4, 1.2);
  const phase = Math.random() * Math.PI * 2;

  return {
    group: g,
    ...extras,
    animate(dt, time) {
      const s = Math.sin(time * 2.2 + phase) * 0.03;
      card.scale.set(1 + s, 1 - s, 1);
      bubble.material.opacity = 0.75 + Math.sin(time * 2.8 + phase) * 0.2;
      bubble.rotation.z = Math.sin(time * 0.9 + phase) * 0.1;
      const bs = 1 + Math.sin(time * 2.8 + phase) * 0.035;
      bubble.scale.setScalar(bs);
    },
  };
}

// --- Solarkollektor: schräg gestelltes Solarpanel mit Akku-Anzeige ---
function buildSolarkollektor() {
  const g = new THREE.Group();
  const card = makeRig(g, 1.25, 3.0);

  const body = spritePlane('def-solar2', 256, 256, 3.4, 3.4, (ctx) => {
    // Standfuß mit Akku-Anzeige
    ctx.fillStyle = lgrad(ctx, 0, 196, 0, 246, [[0, '#4c6b9c'], [1, '#31456e']]);
    rr(ctx, 76, 198, 104, 48, 16); ctx.fill(); o(ctx); ctx.stroke();
    ctx.fillStyle = '#12203c';
    rr(ctx, 92, 210, 72, 22, 8); ctx.fill(); o(ctx, 5); ctx.stroke();
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = i < 2 ? '#aefc4b' : 'rgba(174,252,75,0.25)';
      rr(ctx, 98 + i * 22, 214, 16, 14, 4); ctx.fill();
    }
    // Mast + Gelenk
    ctx.fillStyle = lgrad(ctx, 0, 140, 0, 200, [[0, '#8fa8c9'], [1, '#5b7290']]);
    rr(ctx, 118, 142, 20, 62, 8); ctx.fill(); o(ctx, 7); ctx.stroke();
    ctx.fillStyle = '#38466b';
    ctx.beginPath(); ctx.arc(128, 140, 13, 0, Math.PI * 2); ctx.fill(); o(ctx, 6); ctx.stroke();
    // schräg gestelltes Panel (zeigt zur fernen Sonne rechts oben)
    ctx.save();
    ctx.translate(128, 96);
    ctx.rotate(-0.22);
    // goldener Rahmen
    ctx.fillStyle = lgrad(ctx, 0, -56, 0, 44, [[0, '#ffe082'], [1, '#f5a623']]);
    rr(ctx, -96, -52, 192, 92, 12); ctx.fill(); o(ctx); ctx.stroke();
    // blaue Silizium-Fläche
    ctx.fillStyle = lgrad(ctx, -80, -40, 80, 36, [[0, '#3f8fe8'], [0.55, '#1e63c8'], [1, '#123f8f']]);
    rr(ctx, -84, -40, 168, 68, 7); ctx.fill(); o(ctx, 5); ctx.stroke();
    // Zellen-Raster
    ctx.strokeStyle = 'rgba(220,240,255,0.55)'; ctx.lineWidth = 3;
    for (let i = 1; i < 4; i++) {
      ctx.beginPath(); ctx.moveTo(-84 + i * 42, -40); ctx.lineTo(-84 + i * 42, 28); ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(-84, -6); ctx.lineTo(84, -6); ctx.stroke();
    // diagonaler Sonnen-Glint
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.beginPath();
    ctx.moveTo(-58, -40); ctx.lineTo(-22, -40); ctx.lineTo(-58, 28); ctx.lineTo(-84, 28);
    ctx.closePath(); ctx.fill();
    // Eck-Schrauben
    ctx.fillStyle = '#8a5a00';
    for (const [sx, sy] of [[-88, -44], [88, -44], [-88, 32], [88, 32]]) {
      ctx.beginPath(); ctx.arc(sx, sy, 4.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    // Energie-Leitung vom Panel zum Akku
    ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(148, 150); ctx.quadraticCurveTo(162, 178, 152, 204); ctx.stroke();
  });
  body.position.y = 1.7;
  card.add(body);

  const spark = sparklePlane('gold', '#ffe082', 0.8);
  spark.position.set(0.9, 2.7, 0.08);
  card.add(spark);

  const extras = attachDefenderExtras(card, 3.1, 1.7);
  const phase = Math.random() * Math.PI * 2;

  return {
    group: g,
    ...extras,
    animate(dt, time) {
      card.rotation.z = Math.sin(time * 1.1 + phase) * 0.035;
      const s = Math.sin(time * 2.8 + phase) * 0.02;
      card.scale.set(1 + s, 1 - s, 1);
      const tw = Math.max(0, Math.sin(time * 3.5 + phase));
      spark.scale.setScalar(0.4 + tw * 0.8);
      spark.material.opacity = 0.3 + tw * 0.7;
    },
  };
}

// --- Traktorstrahl-Node: Satellitenschüssel mit Schwerkraft-Kegel ---
function buildTraktorstrahl() {
  const g = new THREE.Group();
  const card = makeRig(g, 1.2, 2.8);

  const pod = spritePlane('def-traktor2', 256, 256, 2.9, 2.9, (ctx) => {
    // Fuß
    ctx.fillStyle = lgrad(ctx, 0, 190, 0, 246, [[0, '#4c6b9c'], [1, '#31456e']]);
    rr(ctx, 70, 192, 116, 52, 18); ctx.fill(); o(ctx); ctx.stroke();
    // Rumpf
    ctx.fillStyle = lgrad(ctx, 0, 120, 0, 200, [[0, '#b7f0f7'], [1, '#5b93c9']]);
    rr(ctx, 88, 132, 80, 68, 20); ctx.fill(); o(ctx); ctx.stroke();
    // Sensor-Linse (Technik statt Auge)
    ctx.fillStyle = '#12203c';
    ctx.beginPath(); ctx.arc(128, 162, 19, 0, Math.PI * 2); ctx.fill(); o(ctx, 6); ctx.stroke();
    ctx.strokeStyle = '#40e0ff'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(128, 162, 11, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath(); ctx.arc(122, 155, 3.5, 0, Math.PI * 2); ctx.fill();
    // Schüssel oben (nach oben geöffnet)
    ctx.fillStyle = lgrad(ctx, 0, 82, 0, 132, [[0, '#dff9ff'], [1, '#7fc8e8']]);
    ctx.beginPath();
    ctx.moveTo(58, 92);
    ctx.quadraticCurveTo(128, 152, 198, 92);
    ctx.quadraticCurveTo(128, 116, 58, 92);
    ctx.closePath(); ctx.fill(); o(ctx); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(128, 118); ctx.lineTo(128, 88); o(ctx, 7); ctx.stroke();
    ctx.fillStyle = '#aefc9a';
    ctx.beginPath(); ctx.arc(128, 80, 11, 0, Math.PI * 2); ctx.fill(); o(ctx, 6); ctx.stroke();
  });
  pod.position.y = 1.45;
  card.add(pod);

  const beam = spritePlane('def-traktor-beam', 192, 224, 3.0, 3.5, (ctx) => {
    // nach oben geöffneter Lichtkegel mit Wellenringen
    const gr = lgrad(ctx, 0, 224, 0, 0, [
      [0, 'rgba(120,255,220,0.55)'], [0.6, 'rgba(90,220,255,0.25)'], [1, 'rgba(90,220,255,0)'],
    ]);
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.moveTo(96, 216);
    ctx.lineTo(10, 10);
    ctx.quadraticCurveTo(96, 40, 182, 10);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(190,255,240,0.5)';
    ctx.lineWidth = 5;
    for (const yy of [70, 120, 168]) {
      const wHalf = 86 * (1 - (216 - yy) / 206) + 8; // schmaler nach unten
      ctx.beginPath();
      ctx.ellipse(96, yy, wHalf, 10, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }, { additive: true });
  beam.position.set(0, 3.1, 0.08);
  card.add(beam);

  const extras = attachDefenderExtras(card, 2.6, 1.45);
  const phase = Math.random() * Math.PI * 2;

  return {
    group: g,
    ...extras,
    animate(dt, time) {
      const s = Math.sin(time * 2.4 + phase) * 0.025;
      card.scale.set(1 + s, 1 - s, 1);
      beam.material.opacity = 0.6 + Math.sin(time * 3.4 + phase) * 0.25;
      beam.rotation.z = Math.sin(time * 1.1 + phase) * 0.06;
      beam.position.y = 3.1 + Math.sin(time * 3.4 + phase) * 0.1;
    },
  };
}

// --- Ionenpuls: Tesla-Spule mit Blitz-Kugel, Flächenschaden im Umkreis ---
function buildIonenpuls() {
  const g = new THREE.Group();
  const card = makeRig(g, 1.25, 3.0);

  const body = spritePlane('def-ion', 256, 256, 3.4, 3.4, (ctx) => {
    // Fuß
    ctx.fillStyle = lgrad(ctx, 0, 196, 0, 246, [[0, '#4c6b9c'], [1, '#31456e']]);
    rr(ctx, 70, 200, 116, 46, 16); ctx.fill(); o(ctx); ctx.stroke();
    // konische Säule
    ctx.fillStyle = lgrad(ctx, 0, 140, 0, 204, [[0, '#8fa8c9'], [1, '#5b7290']]);
    ctx.beginPath();
    ctx.moveTo(108, 142); ctx.lineTo(148, 142); ctx.lineTo(142, 204); ctx.lineTo(114, 204);
    ctx.closePath(); ctx.fill(); o(ctx); ctx.stroke();
    // Kupfer-Spulenringe
    ctx.fillStyle = '#ffb300';
    for (const [ry, rw] of [[150, 52], [166, 46], [182, 40]]) {
      rr(ctx, 128 - rw / 2, ry, rw, 11, 5); ctx.fill(); o(ctx, 5); ctx.stroke();
      ctx.fillStyle = '#f5a623';
    }
    // Blitz-Kugel oben
    ctx.fillStyle = rgrad(ctx, 120, 96, 6, 44, [[0, '#ffffff'], [0.45, '#7df3ff'], [1, '#2fa3c9']]);
    ctx.beginPath(); ctx.arc(128, 104, 40, 0, Math.PI * 2); ctx.fill(); o(ctx); ctx.stroke();
    // Mini-Blitze um die Kugel
    ctx.strokeStyle = '#eaffff'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(88, 84); ctx.lineTo(76, 72); ctx.lineTo(84, 70); ctx.lineTo(72, 56); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(170, 92); ctx.lineTo(184, 82); ctx.lineTo(178, 78); ctx.lineTo(192, 66); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(150, 62); ctx.lineTo(158, 46); ctx.stroke();
    // Blitz-Symbol in der Kugel
    ctx.fillStyle = 'rgba(10,60,90,0.85)';
    ctx.beginPath();
    ctx.moveTo(134, 82); ctx.lineTo(114, 108); ctx.lineTo(126, 108);
    ctx.lineTo(120, 128); ctx.lineTo(142, 100); ctx.lineTo(130, 100);
    ctx.closePath(); ctx.fill();
    // Glanz
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath(); ctx.ellipse(112, 82, 12, 7, -0.6, 0, Math.PI * 2); ctx.fill();
  });
  body.position.y = 1.7;
  card.add(body);

  const aura = glowDisc('ion', 'rgba(125,243,255,0.8)', 2.2);
  aura.position.set(0, 2.35, 0.06);
  card.add(aura);

  const extras = attachDefenderExtras(card, 3.1, 1.7);
  const phase = Math.random() * Math.PI * 2;

  return {
    group: g,
    ...extras,
    animate(dt, time) {
      const s = Math.sin(time * 2.5 + phase) * 0.03;
      card.scale.set(1 + s, 1 - s, 1);
      const pulse = 0.6 + Math.sin(time * 4.5 + phase) * 0.4;
      aura.material.opacity = 0.25 + pulse * 0.4;
      aura.scale.setScalar(0.8 + pulse * 0.3);
    },
  };
}

// --- Raketenwerfer: kantiger Werfer mit schräg gestelltem Startrohr ---
function buildRaketenwerfer() {
  const g = new THREE.Group();
  const card = makeRig(g, 1.25, 3.2);

  const body = spritePlane('def-rakete', 256, 256, 3.5, 3.5, (ctx) => {
    // Fuß
    ctx.fillStyle = lgrad(ctx, 0, 200, 0, 248, [[0, '#5a6b93'], [1, '#38466b']]);
    rr(ctx, 60, 202, 136, 44, 16); ctx.fill(); o(ctx); ctx.stroke();
    // Drehturm
    ctx.fillStyle = lgrad(ctx, 0, 148, 0, 210, [[0, '#7f9ec2'], [1, '#4a628f']]);
    rr(ctx, 82, 150, 92, 60, 16); ctx.fill(); o(ctx); ctx.stroke();
    // Radar-Bogen links
    ctx.strokeStyle = '#bff3ff'; ctx.lineWidth = 6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(92, 140, 20, Math.PI * 0.9, Math.PI * 1.7); ctx.stroke();
    ctx.fillStyle = '#40e0ff';
    ctx.beginPath(); ctx.arc(84, 122, 6, 0, Math.PI * 2); ctx.fill(); o(ctx, 4); ctx.stroke();
    // schräges Startrohr nach rechts oben
    ctx.save();
    ctx.translate(148, 132);
    ctx.rotate(-0.55);
    ctx.fillStyle = lgrad(ctx, -20, 0, 26, 0, [[0, '#6b7fa8'], [1, '#3f5378']]);
    rr(ctx, -22, -78, 48, 100, 12); ctx.fill(); o(ctx); ctx.stroke();
    // Warnstreifen an der Mündung
    ctx.save();
    rr(ctx, -22, -78, 48, 20, 10); ctx.clip();
    for (let i = -2; i < 4; i++) {
      ctx.fillStyle = i % 2 ? '#ffd23f' : '#2b2b33';
      ctx.beginPath();
      ctx.moveTo(-22 + i * 16, -58); ctx.lineTo(-22 + i * 16 + 10, -78);
      ctx.lineTo(-22 + i * 16 + 26, -78); ctx.lineTo(-22 + i * 16 + 16, -58);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    // Rakete lugt heraus: roter Kegel + weißer Korpus
    ctx.fillStyle = '#f2f6ff';
    rr(ctx, -10, -104, 24, 30, 8); ctx.fill(); o(ctx, 6); ctx.stroke();
    ctx.fillStyle = '#ff5252';
    ctx.beginPath();
    ctx.moveTo(-10, -102); ctx.lineTo(2, -126); ctx.lineTo(14, -102);
    ctx.closePath(); ctx.fill(); o(ctx, 6); ctx.stroke();
    ctx.restore();
    // Nieten
    ctx.fillStyle = '#31456e';
    for (const [nx, ny] of [[94, 196], [162, 196], [128, 162]]) {
      ctx.beginPath(); ctx.arc(nx, ny, 6, 0, Math.PI * 2); ctx.fill();
    }
    // Glanz
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.beginPath(); ctx.ellipse(100, 158, 14, 7, -0.3, 0, Math.PI * 2); ctx.fill();
  });
  body.position.y = 1.75;
  card.add(body);

  const tip = glowDisc('rocket-tip', 'rgba(255,150,80,0.9)', 0.9);
  tip.position.set(1.15, 3.15, 0.06);
  card.add(tip);

  const extras = attachDefenderExtras(card, 3.2, 1.75);
  g.userData.muzzleOffset = new THREE.Vector3(1.4, 3.6, 0);
  const phase = Math.random() * Math.PI * 2;

  return {
    group: g,
    ...extras,
    animate(dt, time) {
      const s = Math.sin(time * 2.2 + phase) * 0.028;
      card.scale.set(1 + s, 1 - s, 1);
      tip.material.opacity = 0.35 + Math.max(0, Math.sin(time * 3 + phase)) * 0.5;
    },
  };
}

// --- Reparatur-Drohne: schwebender Quadrocopter über Landepad ---
function buildReparaturdrohne() {
  const g = new THREE.Group();
  const card = makeRig(g, 1.25, 2.9);

  const pad = spritePlane('def-repair-pad', 256, 128, 2.9, 1.45, (ctx) => {
    // Landepad mit Markierung
    ctx.fillStyle = lgrad(ctx, 0, 60, 0, 124, [[0, '#4c6b9c'], [1, '#31456e']]);
    rr(ctx, 24, 56, 208, 60, 20); ctx.fill(); o(ctx); ctx.stroke();
    ctx.strokeStyle = '#aefc4b'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(128, 86, 26, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(116, 86); ctx.lineTo(140, 86); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(128, 74); ctx.lineTo(128, 98); ctx.stroke();
    // Positionslichter
    for (const lx of [44, 212]) {
      ctx.fillStyle = '#40e0ff';
      ctx.beginPath(); ctx.arc(lx, 86, 8, 0, Math.PI * 2); ctx.fill(); o(ctx, 5); ctx.stroke();
    }
  });
  pad.position.y = 0.75;
  card.add(pad);

  const drone = spritePlane('def-repair-drone', 256, 160, 2.7, 1.7, (ctx) => {
    // Rotor-Ausleger
    ctx.strokeStyle = '#38466b'; ctx.lineWidth = 10; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(92, 84); ctx.lineTo(40, 62); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(164, 84); ctx.lineTo(216, 62); ctx.stroke();
    // Rotor-Unschärfescheiben
    ctx.fillStyle = 'rgba(190,230,255,0.5)';
    ctx.beginPath(); ctx.ellipse(40, 58, 34, 9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(216, 58, 34, 9, 0, 0, Math.PI * 2); ctx.fill();
    o(ctx, 4);
    ctx.beginPath(); ctx.ellipse(40, 58, 34, 9, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(216, 58, 34, 9, 0, 0, Math.PI * 2); ctx.stroke();
    // Rumpf
    ctx.fillStyle = lgrad(ctx, 0, 66, 0, 130, [[0, '#eafff2'], [1, '#9fd8c2']]);
    rr(ctx, 92, 64, 72, 52, 18); ctx.fill(); o(ctx); ctx.stroke();
    // grünes Kreuz
    ctx.fillStyle = '#3ecf6a';
    rr(ctx, 120, 74, 16, 34, 4); ctx.fill();
    rr(ctx, 111, 83, 34, 16, 4); ctx.fill();
    o(ctx, 4);
    rr(ctx, 120, 74, 16, 34, 4); ctx.stroke();
    rr(ctx, 111, 83, 34, 16, 4); ctx.stroke();
    // Greifarme unten
    ctx.strokeStyle = '#38466b'; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(104, 116); ctx.lineTo(98, 136); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(152, 116); ctx.lineTo(158, 136); ctx.stroke();
    // Scheinwerfer
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath(); ctx.arc(128, 118, 7, 0, Math.PI * 2); ctx.fill(); o(ctx, 4); ctx.stroke();
  });
  drone.position.y = 2.3;
  card.add(drone);

  const extras = attachDefenderExtras(card, 2.5, 1.5);
  const phase = Math.random() * Math.PI * 2;

  return {
    group: g,
    ...extras,
    animate(dt, time) {
      const s = Math.sin(time * 2.6 + phase) * 0.02;
      card.scale.set(1 + s, 1 - s, 1);
      drone.position.y = 2.3 + Math.sin(time * 2.8 + phase) * 0.18;
      drone.rotation.z = Math.sin(time * 1.7 + phase) * 0.06;
    },
  };
}

// ============================================================
// Gegner
// ============================================================

export function buildEnemyMesh(typeId) {
  switch (typeId) {
    case 'kleinasteroid': return buildAsteroid();
    case 'schrottbrocken': return buildSchrott();
    case 'berstbrocken': return buildBerstbrocken();
    case 'alienDrohne': return buildDrohne();
    case 'schwarmling': return buildSchwarmling();
    case 'phasenspringer': return buildPhasenspringer();
    case 'panzerwalze': return buildPanzerwalze();
    case 'alienZerstoerer': return buildZerstoerer();
    case 'mutterschiffFragment': return buildMutterschiff();
    default: throw new Error(`Unbekannter Gegner-Typ: ${typeId}`);
  }
}

// ------------------------------------------------------------
// Lexikon-Thumbnails: liefert die Sprite-Zeichnung als Daten-URL
// ------------------------------------------------------------
const THUMB_KEYS = {
  defender: {
    solarkollektor: 'def-solar2', laserturm: 'def-laser2', schildgenerator: 'def-schild2',
    traktorstrahl: 'def-traktor2', plasmakanone: 'def-plasma2', ionenpuls: 'def-ion',
    raketenwerfer: 'def-rakete', reparaturdrohne: 'def-repair-drone',
  },
  enemy: {
    kleinasteroid: 'en-asteroid', schrottbrocken: 'en-schrott', berstbrocken: 'en-berst',
    alienDrohne: 'en-drohne', schwarmling: 'en-schwarmling', phasenspringer: 'en-phase',
    panzerwalze: 'en-panzer', alienZerstoerer: 'en-zerstoerer', mutterschiffFragment: 'en-boss',
  },
};

export function getThumbnail(kind, typeId) {
  const key = THUMB_KEYS[kind]?.[typeId];
  if (!key) return null;
  if (!texCache.has(key)) {
    // Textur durch einmaliges Bauen erzeugen (Wegwerf-Mesh)
    try {
      kind === 'enemy' ? buildEnemyMesh(typeId) : buildDefenderMesh(typeId);
    } catch {
      return null;
    }
  }
  const canvas = texCache.get(key)?.source?.data;
  return canvas?.toDataURL ? canvas.toDataURL() : null;
}

// unregelmäßige Felsblob-Silhouette (deterministisch pro Textur-Key)
function rockPath(ctx, cx, cy, r, bumps) {
  ctx.beginPath();
  for (let i = 0; i <= bumps.length; i++) {
    const a = (i % bumps.length) / bumps.length * Math.PI * 2;
    const rr2 = r * bumps[i % bumps.length];
    const x = cx + Math.cos(a) * rr2;
    const y = cy + Math.sin(a) * rr2;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.closePath();
}

// --- Kleinasteroid: grantiger Cartoon-Fels ---
function buildAsteroid() {
  const g = new THREE.Group();
  const card = makeRig(g, 1.3, 2.6);

  const rock = spritePlane('en-asteroid', 256, 256, 2.7, 2.7, (ctx) => {
    const bumps = [1.0, 0.86, 1.05, 0.9, 1.08, 0.84, 1.0, 0.92, 1.06, 0.88];
    ctx.fillStyle = rgrad(ctx, 100, 100, 20, 130, [[0, '#b6a284'], [0.6, '#8d7c62'], [1, '#5f5142']]);
    rockPath(ctx, 128, 130, 96, bumps); ctx.fill(); o(ctx); ctx.stroke();
    // Krater
    ctx.fillStyle = 'rgba(60,48,36,0.5)';
    for (const [kx, ky, kr] of [[86, 180, 15], [178, 158, 12], [162, 74, 10]]) {
      ctx.beginPath(); ctx.ellipse(kx, ky, kr, kr * 0.7, 0.3, 0, Math.PI * 2); ctx.fill();
    }
    // grantiges Gesicht
    angryEye(ctx, 100, 112, 15, -1, '#ffffff');
    angryEye(ctx, 150, 112, 15, 1, '#ffffff');
    ctx.beginPath(); ctx.arc(126, 172, 20, 1.15 * Math.PI, 1.85 * Math.PI); o(ctx, 7); ctx.stroke();
    // Glanzkante
    ctx.strokeStyle = 'rgba(255,244,214,0.5)'; ctx.lineWidth = 7; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(112, 96, 74, 1.15 * Math.PI, 1.5 * Math.PI); ctx.stroke();
  });
  rock.position.y = 1.35;
  card.add(rock);

  const phase = Math.random() * Math.PI * 2;

  return {
    group: g,
    animate(dt, time) {
      card.rotation.z = Math.sin(time * 3.2 + phase) * 0.16;
      card.position.y = Math.sin(time * 2.4 + phase) * 0.08;
    },
  };
}

// --- Schrottbrocken: rostiger Müllhaufen mit Warnstreifen ---
function buildSchrott() {
  const g = new THREE.Group();
  const card = makeRig(g, 1.25, 3.0);

  const junk = spritePlane('en-schrott', 256, 256, 3.1, 3.1, (ctx) => {
    // Panel mit Warnstreifen (schräg hinten)
    ctx.save();
    ctx.translate(170, 120); ctx.rotate(0.35);
    ctx.fillStyle = '#9aa3ad';
    rr(ctx, -46, -60, 92, 120, 12); ctx.fill(); o(ctx); ctx.stroke();
    ctx.save();
    rr(ctx, -46, 18, 92, 34, 8); ctx.clip();
    for (let i = -3; i < 6; i++) {
      ctx.fillStyle = i % 2 ? '#ffd23f' : '#2b2b33';
      ctx.beginPath();
      ctx.moveTo(-46 + i * 24, 52); ctx.lineTo(-46 + i * 24 + 16, 18);
      ctx.lineTo(-46 + i * 24 + 40, 18); ctx.lineTo(-46 + i * 24 + 24, 52);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    ctx.restore();
    // rostiges Fass
    ctx.fillStyle = lgrad(ctx, 60, 0, 150, 0, [[0, '#c96f3b'], [0.5, '#e08a4e'], [1, '#a35427']]);
    rr(ctx, 58, 116, 92, 112, 20); ctx.fill(); o(ctx); ctx.stroke();
    ctx.strokeStyle = 'rgba(70,35,10,0.55)'; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(60, 150); ctx.lineTo(148, 150); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(60, 192); ctx.lineTo(148, 192); ctx.stroke();
    // Rostflecken
    ctx.fillStyle = 'rgba(110,60,20,0.6)';
    ctx.beginPath(); ctx.ellipse(84, 136, 13, 9, 0.4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(130, 210, 11, 8, -0.3, 0, Math.PI * 2); ctx.fill();
    // verbogenes Rohr
    ctx.strokeStyle = '#7c8894'; ctx.lineWidth = 22; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(52, 108); ctx.quadraticCurveTo(20, 70, 56, 48); ctx.stroke();
    o(ctx, 30);
    ctx.globalCompositeOperation = 'destination-over';
    ctx.beginPath(); ctx.moveTo(52, 108); ctx.quadraticCurveTo(20, 70, 56, 48); ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
    // müde Roboteraugen auf dem Fass
    eye(ctx, 88, 126, 12, -0.3, 0.3);
    eye(ctx, 124, 126, 12, -0.3, 0.3);
    ctx.beginPath(); ctx.moveTo(88, 158); ctx.quadraticCurveTo(106, 150, 124, 158); o(ctx, 6); ctx.stroke();
    // Schraube
    ctx.fillStyle = '#d7dde3';
    ctx.beginPath(); ctx.arc(196, 210, 12, 0, Math.PI * 2); ctx.fill(); o(ctx, 5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(189, 203); ctx.lineTo(203, 217); o(ctx, 4); ctx.stroke();
  });
  junk.position.y = 1.5;
  card.add(junk);

  const warnLight = glowDisc('warn', 'rgba(255,80,60,0.9)', 0.7);
  warnLight.position.set(-1.1, 2.4, 0.06);
  card.add(warnLight);

  const phase = Math.random() * Math.PI * 2;

  return {
    group: g,
    animate(dt, time) {
      card.rotation.z = Math.sin(time * 2.1 + phase) * 0.1;
      card.position.y = Math.sin(time * 1.7 + phase) * 0.07;
      warnLight.material.opacity = Math.sin(time * 5 + phase) > 0 ? 0.9 : 0.15;
    },
  };
}

// --- Berstbrocken: instabiler Fels mit glühenden Rissen, zerbirst beim Tod ---
function buildBerstbrocken() {
  const g = new THREE.Group();
  const card = makeRig(g, 1.28, 2.8);

  const rock = spritePlane('en-berst', 256, 256, 2.9, 2.9, (ctx) => {
    const bumps = [1.05, 0.88, 1.02, 0.92, 1.1, 0.86, 0.98, 0.94, 1.04, 0.9];
    ctx.fillStyle = rgrad(ctx, 100, 100, 20, 130, [[0, '#a08468'], [0.6, '#7c674f'], [1, '#4f4234']]);
    rockPath(ctx, 128, 130, 96, bumps); ctx.fill(); o(ctx); ctx.stroke();
    // glühende Berst-Risse
    ctx.strokeStyle = '#ff8a3c'; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(128, 52); ctx.lineTo(118, 96); ctx.lineTo(142, 128); ctx.lineTo(126, 170); ctx.lineTo(140, 204);
    ctx.stroke();
    ctx.beginPath(); ctx.moveTo(118, 96); ctx.lineTo(84, 112); ctx.lineTo(62, 104); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(142, 128); ctx.lineTo(182, 118); ctx.lineTo(198, 132); ctx.stroke();
    ctx.strokeStyle = '#ffd9a0'; ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(128, 52); ctx.lineTo(118, 96); ctx.lineTo(142, 128); ctx.lineTo(126, 170);
    ctx.stroke();
    // gestresstes Gesicht (zusammengekniffen)
    ctx.beginPath(); ctx.moveTo(84, 104); ctx.lineTo(104, 112); o(ctx, 8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(172, 112); ctx.lineTo(152, 118); o(ctx, 8); ctx.stroke();
    ctx.beginPath(); ctx.arc(126, 152, 14, 1.2 * Math.PI, 1.8 * Math.PI); o(ctx, 7); ctx.stroke();
    // Glanzkante
    ctx.strokeStyle = 'rgba(255,244,214,0.45)'; ctx.lineWidth = 7; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(112, 96, 74, 1.15 * Math.PI, 1.5 * Math.PI); ctx.stroke();
  });
  rock.position.y = 1.45;
  card.add(rock);

  const glow = glowDisc('berst', 'rgba(255,140,60,0.85)', 1.6);
  glow.position.set(0.1, 1.45, -0.04);
  card.add(glow);

  const phase = Math.random() * Math.PI * 2;

  return {
    group: g,
    animate(dt, time) {
      // nervöses Zittern statt gemütlichem Wackeln
      card.rotation.z = Math.sin(time * 9 + phase) * 0.05;
      card.position.y = Math.sin(time * 2.2 + phase) * 0.07;
      glow.material.opacity = 0.45 + Math.sin(time * 6 + phase) * 0.3;
    },
  };
}

// --- Schwarmling: winziger Beißer mit einem Auge und Stummelflügeln ---
function buildSchwarmling() {
  const g = new THREE.Group();
  const card = makeRig(g, 1.15, 1.7);

  const bug = spritePlane('en-schwarmling', 192, 192, 1.9, 1.9, (ctx) => {
    // Stummelflügel
    ctx.fillStyle = 'rgba(190,240,200,0.55)';
    ctx.strokeStyle = '#1b2447'; ctx.lineWidth = 6; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.ellipse(52, 74, 30, 14, -0.6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(140, 74, 30, 14, 0.6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // Kugel-Körper
    ctx.fillStyle = rgrad(ctx, 86, 88, 8, 60, [[0, '#c26bd6'], [0.6, '#8e24aa'], [1, '#5c1687']]);
    ctx.beginPath(); ctx.arc(96, 104, 52, 0, Math.PI * 2); ctx.fill(); o(ctx, 7); ctx.stroke();
    // ein großes Auge
    ctx.fillStyle = '#aefc4b';
    ctx.beginPath(); ctx.arc(88, 96, 20, 0, Math.PI * 2); ctx.fill(); o(ctx, 6); ctx.stroke();
    ctx.fillStyle = OUTLINE;
    ctx.beginPath(); ctx.arc(81, 98, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(78, 94, 3.5, 0, Math.PI * 2); ctx.fill();
    // Beißer-Mund
    ctx.fillStyle = '#1c0330';
    ctx.beginPath();
    ctx.moveTo(64, 132); ctx.lineTo(76, 142); ctx.lineTo(88, 132); ctx.lineTo(100, 142); ctx.lineTo(112, 132);
    ctx.lineTo(112, 146) ; ctx.lineTo(64, 146); ctx.closePath(); ctx.fill();
    o(ctx, 5); ctx.stroke();
    // Fühler
    ctx.beginPath(); ctx.moveTo(116, 62); ctx.lineTo(128, 44); o(ctx, 5); ctx.stroke();
    ctx.fillStyle = '#ff4dd2';
    ctx.beginPath(); ctx.arc(131, 39, 6, 0, Math.PI * 2); ctx.fill(); o(ctx, 4); ctx.stroke();
  });
  bug.position.y = 1.15;
  card.add(bug);

  const engine = glowDisc('schwarm-engine', 'rgba(150,255,90,0.85)', 1.0);
  engine.position.set(0, 0.4, 0.04);
  engine.scale.set(1, 0.4, 1);
  card.add(engine);

  const phase = Math.random() * Math.PI * 2;

  return {
    group: g,
    animate(dt, time) {
      card.position.y = Math.sin(time * 7 + phase) * 0.12;
      card.rotation.z = Math.sin(time * 5 + phase) * 0.14;
      engine.material.opacity = 0.5 + Math.sin(time * 13 + phase) * 0.35;
    },
  };
}

// --- Phasenspringer: durchscheinendes Energiewesen mit Phasenringen ---
function buildPhasenspringer() {
  const g = new THREE.Group();
  const card = makeRig(g, 1.25, 2.4);

  const ghost = spritePlane('en-phase', 224, 256, 2.5, 2.85, (ctx) => {
    // Tropfen-Körper, halbtransparent
    const grd = lgrad(ctx, 0, 40, 0, 230, [
      [0, 'rgba(150,240,255,0.95)'], [0.5, 'rgba(120,140,255,0.8)'], [1, 'rgba(140,80,220,0.35)'],
    ]);
    ctx.fillStyle = grd;
    ctx.strokeStyle = '#1b2447'; ctx.lineWidth = 8; ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(112, 30);
    ctx.quadraticCurveTo(180, 60, 176, 130);
    ctx.quadraticCurveTo(172, 190, 140, 226);
    ctx.quadraticCurveTo(112, 244, 84, 226);
    ctx.quadraticCurveTo(52, 190, 48, 130);
    ctx.quadraticCurveTo(44, 60, 112, 30);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    // Phasen-Ringe um den Körper
    ctx.strokeStyle = 'rgba(190,250,255,0.85)'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.ellipse(112, 110, 76, 14, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(194,107,214,0.75)'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.ellipse(112, 160, 62, 11, 0, 0, Math.PI * 2); ctx.stroke();
    // großes hypnotisches Auge
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(112, 84, 24, 0, Math.PI * 2); ctx.fill(); o(ctx, 6); ctx.stroke();
    ctx.fillStyle = '#7b1fa2';
    ctx.beginPath(); ctx.arc(112, 86, 13, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(107, 81, 4, 0, Math.PI * 2); ctx.fill();
    // kleiner o-Mund
    ctx.fillStyle = OUTLINE;
    ctx.beginPath(); ctx.ellipse(112, 128, 8, 11, 0, 0, Math.PI * 2); ctx.fill();
    // Funken im Saum
    ctx.fillStyle = '#c9fbff';
    for (const [fx, fy] of [[76, 196], [148, 200], [112, 216]]) {
      ctx.beginPath(); ctx.arc(fx, fy, 5, 0, Math.PI * 2); ctx.fill();
    }
  });
  ghost.position.y = 1.55;
  card.add(ghost);

  const halo = glowDisc('phase-halo', 'rgba(140,120,255,0.7)', 2.4);
  halo.position.set(0, 1.55, -0.05);
  card.add(halo);

  const phase = Math.random() * Math.PI * 2;

  return {
    group: g,
    animate(dt, time) {
      card.position.y = Math.sin(time * 2.4 + phase) * 0.18;
      card.rotation.z = Math.sin(time * 1.6 + phase) * 0.07;
      ghost.material.opacity = 0.75 + Math.sin(time * 4 + phase) * 0.2;
      halo.material.opacity = 0.4 + Math.sin(time * 4 + phase) * 0.25;
    },
  };
}

// --- Panzerwalze: rollende Alien-Festung mit Sichtschlitz ---
function buildPanzerwalze() {
  const g = new THREE.Group();
  const card = makeRig(g, 1.25, 3.4);

  const tank = spritePlane('en-panzer', 256, 224, 3.3, 2.9, (ctx) => {
    // Laufketten-Walze
    ctx.fillStyle = lgrad(ctx, 0, 130, 0, 200, [[0, '#3a4258'], [1, '#20263a']]);
    rr(ctx, 30, 132, 196, 64, 32); ctx.fill(); o(ctx); ctx.stroke();
    // Ketten-Segmente
    ctx.fillStyle = '#535e7c';
    for (let i = 0; i < 6; i++) {
      ctx.beginPath(); ctx.arc(58 + i * 28, 164, 11, 0, Math.PI * 2); ctx.fill();
      o(ctx, 4); ctx.stroke();
    }
    // gewölbter Panzer-Dom
    ctx.fillStyle = lgrad(ctx, 0, 40, 0, 140, [[0, '#8e5bb0'], [0.55, '#6a3691'], [1, '#472066']]);
    ctx.beginPath(); ctx.arc(128, 134, 88, Math.PI, 0); ctx.closePath(); ctx.fill(); o(ctx); ctx.stroke();
    // Panzerplatten-Fugen + Nieten
    ctx.strokeStyle = 'rgba(25,10,45,0.6)'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(128, 134, 62, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(128, 46); ctx.lineTo(128, 70); ctx.stroke();
    ctx.fillStyle = '#b98ad2';
    for (const a of [1.15, 1.4, 1.6, 1.85]) {
      const x = 128 + Math.cos(a * Math.PI) * 76, yy = 134 + Math.sin(a * Math.PI) * 76;
      ctx.beginPath(); ctx.arc(x, yy, 6, 0, Math.PI * 2); ctx.fill();
    }
    // Sichtschlitz mit bösen Augen
    ctx.fillStyle = '#12081f';
    rr(ctx, 82, 96, 92, 26, 13); ctx.fill(); o(ctx, 6); ctx.stroke();
    angryEye(ctx, 110, 109, 9, -1);
    angryEye(ctx, 146, 109, 9, 1);
    // Frontal-Ramme
    ctx.fillStyle = '#3a4258';
    ctx.beginPath();
    ctx.moveTo(38, 120); ctx.lineTo(14, 134); ctx.lineTo(38, 148);
    ctx.closePath(); ctx.fill(); o(ctx, 6); ctx.stroke();
    // Glanz
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath(); ctx.ellipse(96, 70, 26, 10, -0.4, 0, Math.PI * 2); ctx.fill();
  });
  tank.position.y = 1.45;
  card.add(tank);

  const phase = Math.random() * Math.PI * 2;

  return {
    group: g,
    animate(dt, time) {
      // schwerfälliges Stampfen
      card.position.y = Math.abs(Math.sin(time * 2.2 + phase)) * 0.06;
      card.rotation.z = Math.sin(time * 2.2 + phase) * 0.02;
    },
  };
}

// --- Alien-Drohne: fieses kleines UFO mit Riesen-Auge ---
function buildDrohne() {
  const g = new THREE.Group();
  const card = makeRig(g, 1.3, 2.6);

  const saucer = spritePlane('en-drohne', 256, 256, 2.8, 2.8, (ctx) => {
    // Untertassen-Teller
    ctx.fillStyle = lgrad(ctx, 0, 128, 0, 190, [[0, '#c26bd6'], [1, '#6a1b9a']]);
    ctx.beginPath(); ctx.ellipse(128, 152, 108, 42, 0, 0, Math.PI * 2); ctx.fill(); o(ctx); ctx.stroke();
    // Positionslichter
    for (let i = 0; i < 5; i++) {
      const lx = 44 + i * 42;
      ctx.fillStyle = i % 2 ? '#aefc4b' : '#ffd23f';
      ctx.beginPath(); ctx.arc(lx, 160, 8, 0, Math.PI * 2); ctx.fill(); o(ctx, 5); ctx.stroke();
    }
    // Glaskuppel
    ctx.fillStyle = rgrad(ctx, 110, 90, 10, 80, [[0, 'rgba(240,255,250,0.95)'], [0.55, 'rgba(170,240,220,0.75)'], [1, 'rgba(110,200,190,0.55)']]);
    ctx.beginPath(); ctx.arc(128, 112, 62, Math.PI, 0); ctx.closePath(); ctx.fill(); o(ctx); ctx.stroke();
    // ein großes fieses Auge in der Kuppel
    ctx.fillStyle = '#aefc4b';
    ctx.beginPath(); ctx.arc(122, 96, 26, 0, Math.PI * 2); ctx.fill(); o(ctx, 6); ctx.stroke();
    ctx.fillStyle = OUTLINE;
    ctx.beginPath(); ctx.arc(114, 98, 11, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(110, 93, 4, 0, Math.PI * 2); ctx.fill();
    // Braue
    ctx.beginPath(); ctx.moveTo(96, 72); ctx.lineTo(148, 84); o(ctx, 8); ctx.stroke();
    // Antenne
    ctx.beginPath(); ctx.moveTo(160, 62); ctx.lineTo(172, 38); o(ctx, 6); ctx.stroke();
    ctx.fillStyle = '#ff4dd2';
    ctx.beginPath(); ctx.arc(175, 32, 8, 0, Math.PI * 2); ctx.fill(); o(ctx, 5); ctx.stroke();
    // Teller-Glanz
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.beginPath(); ctx.ellipse(76, 140, 26, 9, -0.15, 0, Math.PI * 2); ctx.fill();
  });
  saucer.position.y = 1.5;
  card.add(saucer);

  const engine = glowDisc('drone-engine', 'rgba(150,255,90,0.9)', 1.6);
  engine.position.set(0, 0.55, 0.05);
  engine.scale.set(1, 0.45, 1);
  card.add(engine);

  const phase = Math.random() * Math.PI * 2;

  return {
    group: g,
    animate(dt, time) {
      card.position.y = Math.sin(time * 5 + phase) * 0.14;
      card.rotation.z = Math.sin(time * 3.3 + phase) * 0.09;
      engine.material.opacity = 0.55 + Math.sin(time * 11 + phase) * 0.3;
    },
  };
}

// --- Alien-Zerstörer: kantiges Kampfschiff mit Bugkanone (fliegt nach links) ---
function buildZerstoerer() {
  const g = new THREE.Group();
  const card = makeRig(g, 1.2, 3.4);

  const ship = spritePlane('en-zerstoerer', 288, 224, 3.9, 3.0, (ctx) => {
    // Heck-Finnen
    ctx.fillStyle = '#5c1687';
    ctx.beginPath(); ctx.moveTo(214, 96); ctx.lineTo(276, 56); ctx.lineTo(252, 108); ctx.closePath(); ctx.fill(); o(ctx, 7); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(214, 128); ctx.lineTo(276, 168); ctx.lineTo(252, 118); ctx.closePath(); ctx.fill(); o(ctx, 7); ctx.stroke();
    // Rumpf (Pfeil nach links)
    ctx.fillStyle = lgrad(ctx, 0, 60, 0, 170, [[0, '#a44bd0'], [0.55, '#7b1fa2'], [1, '#4d1070']]);
    ctx.beginPath();
    ctx.moveTo(18, 112);
    ctx.lineTo(96, 62); ctx.lineTo(230, 74);
    ctx.quadraticCurveTo(258, 112, 230, 150);
    ctx.lineTo(96, 162); ctx.closePath();
    ctx.fill(); o(ctx); ctx.stroke();
    // Bugkanone
    ctx.fillStyle = '#3a3f52';
    rr(ctx, 6, 100, 56, 24, 10); ctx.fill(); o(ctx, 7); ctx.stroke();
    ctx.fillStyle = '#aefc4b';
    ctx.beginPath(); ctx.arc(12, 112, 8, 0, Math.PI * 2); ctx.fill();
    // Cockpit mit zwei bösen Augen
    ctx.fillStyle = rgrad(ctx, 120, 96, 6, 52, [[0, 'rgba(230,255,235,0.95)'], [1, 'rgba(140,230,190,0.6)']]);
    ctx.beginPath(); ctx.ellipse(128, 104, 46, 30, 0, 0, Math.PI * 2); ctx.fill(); o(ctx, 7); ctx.stroke();
    angryEye(ctx, 110, 104, 12, -1);
    angryEye(ctx, 146, 104, 12, 1);
    // Panel-Linien + Lichter
    ctx.strokeStyle = 'rgba(30,10,50,0.5)'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(96, 140); ctx.lineTo(212, 138); ctx.stroke();
    for (const lx of [110, 150, 190]) {
      ctx.fillStyle = '#aefc4b';
      ctx.beginPath(); ctx.arc(lx, 148, 6, 0, Math.PI * 2); ctx.fill(); o(ctx, 4); ctx.stroke();
    }
    // Glanz
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath(); ctx.ellipse(120, 74, 42, 8, -0.06, 0, Math.PI * 2); ctx.fill();
  });
  ship.position.y = 1.6;
  card.add(ship);

  const flame = spritePlane('en-zerstoerer-flame', 128, 96, 1.5, 1.1, (ctx) => {
    const gr = lgrad(ctx, 0, 0, 128, 0, [
      [0, 'rgba(255,255,255,0)'], [0.35, 'rgba(174,252,75,0.85)'], [1, 'rgba(80,220,140,0)'],
    ]);
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.moveTo(122, 48);
    ctx.quadraticCurveTo(60, 6, 4, 34);
    ctx.quadraticCurveTo(40, 48, 4, 62);
    ctx.quadraticCurveTo(60, 90, 122, 48);
    ctx.closePath(); ctx.fill();
  }, { additive: true });
  flame.position.set(2.25, 1.55, 0.05);
  card.add(flame);

  const phase = Math.random() * Math.PI * 2;

  return {
    group: g,
    animate(dt, time) {
      card.position.y = Math.sin(time * 2.6 + phase) * 0.1;
      card.rotation.z = Math.sin(time * 1.9 + phase) * 0.05;
      flame.scale.x = 0.8 + Math.sin(time * 16 + phase) * 0.25;
      flame.material.opacity = 0.7 + Math.sin(time * 13 + phase) * 0.3;
    },
  };
}

// --- Mutterschiff-Fragment: riesiges Boss-UFO mit rotierendem Ring ---
function buildMutterschiff() {
  const g = new THREE.Group();
  const card = makeRig(g, 1.12, 5.6);

  const hull = spritePlane('en-boss', 320, 288, 6.2, 5.6, (ctx) => {
    // Zacken oben
    ctx.fillStyle = '#4d1070';
    for (const [sx, sy, sr] of [[104, 62, 0], [160, 44, 0], [216, 62, 0]]) {
      ctx.beginPath();
      ctx.moveTo(sx - 16, sy + 34); ctx.lineTo(sx, sy - 14); ctx.lineTo(sx + 16, sy + 34);
      ctx.closePath(); ctx.fill(); o(ctx, 7); ctx.stroke();
      ctx.fillStyle = '#4d1070';
    }
    // Hauptkörper: wuchtige Untertasse
    ctx.fillStyle = lgrad(ctx, 0, 70, 0, 240, [[0, '#b45fe0'], [0.5, '#7b1fa2'], [1, '#3d0a5c']]);
    ctx.beginPath(); ctx.ellipse(160, 150, 148, 84, 0, 0, Math.PI * 2); ctx.fill(); o(ctx, 11); ctx.stroke();
    // Unterring
    ctx.fillStyle = '#2c0745';
    ctx.beginPath(); ctx.ellipse(160, 196, 108, 34, 0, 0, Math.PI * 2); ctx.fill(); o(ctx, 8); ctx.stroke();
    // grüner Reaktor-Schlund unten
    ctx.fillStyle = rgrad(ctx, 160, 196, 6, 56, [[0, '#f4ffde'], [0.45, '#aefc4b'], [1, '#3f9c3f']]);
    ctx.beginPath(); ctx.ellipse(160, 196, 52, 20, 0, 0, Math.PI * 2); ctx.fill(); o(ctx, 7); ctx.stroke();
    // drei fiese Augen
    angryEye(ctx, 106, 128, 17, -1);
    angryEye(ctx, 160, 118, 22, 1);
    angryEye(ctx, 214, 128, 17, 1);
    // gezackter Mund
    ctx.fillStyle = '#1c0330';
    ctx.beginPath();
    ctx.moveTo(112, 166);
    for (let i = 0; i <= 6; i++) {
      const mx = 112 + i * 16;
      ctx.lineTo(mx, 166 + (i % 2 ? 14 : 0));
    }
    ctx.lineTo(208, 182); ctx.lineTo(112, 182); ctx.closePath(); ctx.fill();
    o(ctx, 6); ctx.stroke();
    // Panel-Lichter
    for (let i = 0; i < 7; i++) {
      const a = Math.PI * (0.15 + i * 0.115);
      const lx = 160 + Math.cos(a) * 132, ly = 150 + Math.sin(a) * 72;
      ctx.fillStyle = i % 2 ? '#ff4dd2' : '#aefc4b';
      ctx.beginPath(); ctx.arc(lx, ly, 8, 0, Math.PI * 2); ctx.fill(); o(ctx, 5); ctx.stroke();
    }
    // Glanz
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath(); ctx.ellipse(104, 96, 52, 16, -0.35, 0, Math.PI * 2); ctx.fill();
  });
  hull.position.y = 2.7;
  card.add(hull);

  const core = glowDisc('boss-core', 'rgba(174,252,75,0.95)', 2.4);
  core.position.set(0, 1.35, 0.1);
  card.add(core);

  // flacher Energie-Ring, der um das Schiff rotiert
  const ring = spritePlane('en-boss-ring', 256, 256, 8.0, 8.0, (ctx) => {
    ctx.strokeStyle = 'rgba(255,77,210,0.75)';
    ctx.lineWidth = 10;
    ctx.beginPath(); ctx.arc(128, 128, 104, 0, Math.PI * 2); ctx.stroke();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      ctx.fillStyle = i % 2 ? '#ff4dd2' : '#aefc4b';
      ctx.beginPath();
      ctx.arc(128 + Math.cos(a) * 104, 128 + Math.sin(a) * 104, 9, 0, Math.PI * 2);
      ctx.fill();
    }
  }, { additive: true });
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 2.0;
  g.add(ring);

  const phase = Math.random() * Math.PI * 2;
  let weakOpen = false; // Schwächephase: Reaktorschlund offen -> doppelter Schaden

  return {
    group: g,
    setWeak(on) { weakOpen = on; },
    animate(dt, time) {
      card.position.y = Math.sin(time * 1.6 + phase) * 0.16;
      card.rotation.z = Math.sin(time * 1.1 + phase) * 0.035;
      ring.rotation.z += dt * (weakOpen ? 3.2 : 0.9);
      if (weakOpen) {
        // Schlund weit offen: Kern grell und groß, deutliches "Jetzt zuschlagen!"-Signal
        const pulse = 1.5 + Math.sin(time * 12 + phase) * 0.35;
        core.scale.setScalar(pulse);
        core.material.opacity = 0.95;
      } else {
        const pulse = 0.8 + Math.sin(time * 4 + phase) * 0.25;
        core.scale.setScalar(pulse);
        core.material.opacity = 0.5 + pulse * 0.35;
      }
    },
  };
}
