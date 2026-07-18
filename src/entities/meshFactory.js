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
// rotes Schaden-Modul (Kraft-Pfad upA): kantiger Panzer-Aufsatz mit Glutkern
function drawPowerModule(ctx) {
  ctx.fillStyle = '#3a1418';
  rr(ctx, 20, 24, 56, 56, 12); ctx.fill();
  ctx.strokeStyle = '#1b2447'; ctx.lineWidth = 7; ctx.lineJoin = 'round'; ctx.stroke();
  ctx.fillStyle = rgrad(ctx, 48, 52, 3, 26, [[0, '#fff'], [0.4, '#ff7a3c'], [1, '#c21414']]);
  ctx.beginPath(); ctx.arc(48, 52, 20, 0, Math.PI * 2); ctx.fill();
  // Kühlspitzen oben
  ctx.fillStyle = '#8a2a20';
  for (const sx of [30, 48, 66]) {
    ctx.beginPath(); ctx.moveTo(sx - 6, 26); ctx.lineTo(sx, 10); ctx.lineTo(sx + 6, 26); ctx.closePath(); ctx.fill();
  }
}

// cyan Tempo-Modul (Tempo-Pfad upB): Turbine mit Rotorblättern
function drawSpeedModule(ctx) {
  ctx.fillStyle = '#0e2a38';
  ctx.beginPath(); ctx.arc(48, 50, 30, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#1b2447'; ctx.lineWidth = 6; ctx.stroke();
  // Rotor
  ctx.fillStyle = '#40e0ff';
  for (let i = 0; i < 4; i++) {
    ctx.save(); ctx.translate(48, 50); ctx.rotate(i * Math.PI / 2);
    ctx.beginPath(); ctx.moveTo(0, -6); ctx.quadraticCurveTo(24, -14, 26, 0); ctx.quadraticCurveTo(10, 2, 0, 6); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = '#eaffff';
  ctx.beginPath(); ctx.arc(48, 50, 7, 0, Math.PI * 2); ctx.fill();
}

// Ausbau-Optik: pfad-spezifische Anbauten statt Gold-Aura.
// upA (Kraft) -> rote Schaden-Module, upB (Tempo) -> cyan Turbinen.
// Nur die Anzahl zeigt die Stufe; das Gebäude wächst nur minimal.
function attachDefenderExtras(card, size, y) {
  const d1 = spritePlane('def-damage-1', 256, 256, size, size, drawCracks1);
  d1.position.set(0, y, 0.12);
  d1.visible = false;
  card.add(d1);
  const d2 = spritePlane('def-damage-2', 256, 256, size, size, drawCracks2);
  d2.position.set(0, y, 0.13);
  d2.visible = false;
  card.add(d2);

  const sizer = card.parent;
  const modSize = size * 0.34;

  // rote Kraft-Module rechts, cyan Tempo-Module links — je bis zu 2 Stufen
  const powerMods = [];
  const speedMods = [];
  for (let i = 0; i < 2; i++) {
    const pm = spritePlane('mod-power', 96, 96, modSize, modSize, drawPowerModule);
    pm.position.set(size * 0.34, y - size * 0.20 + i * (modSize * 0.82), 0.16);
    pm.visible = false; card.add(pm); powerMods.push(pm);

    const sm = spritePlane('mod-speed', 96, 96, modSize, modSize, drawSpeedModule);
    sm.position.set(-size * 0.34, y - size * 0.20 + i * (modSize * 0.82), 0.16);
    sm.visible = false; card.add(sm); speedMods.push(sm);
  }

  return {
    setDamage(stage) {
      d1.visible = stage >= 1;
      d2.visible = stage >= 2;
    },
    // upA = Kraft-Stufen (rot), upB = Tempo-Stufen (cyan)
    setUpgrade(upA, upB) {
      powerMods.forEach((m, i) => { m.visible = i < upA; });
      speedMods.forEach((m, i) => { m.visible = i < upB; });
      const base = sizer.userData.baseScale ?? 1;
      sizer.scale.setScalar(base * (1 + 0.04 * (upA + upB)));
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
  // rot-crimson statt gold, damit Elite-Gegner nicht mit gelben Upgrades
  // verwechselt werden
  const m = spritePlane('elite-aura', 160, 160, size, size, (ctx) => {
    const g = rgrad(ctx, 80, 80, 24, 78, [
      [0, 'rgba(255,40,60,0)'],
      [0.65, 'rgba(255,50,70,0.4)'],
      [0.88, 'rgba(255,70,90,0.7)'],
      [1, 'rgba(255,40,60,0)'],
    ]);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(80, 80, 78, 0, Math.PI * 2); ctx.fill();
    // kleine Zacken-Krone oben (dunkelrot)
    ctx.fillStyle = '#ff3b52';
    ctx.strokeStyle = '#5c0a14'; ctx.lineWidth = 4; ctx.lineJoin = 'round';
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

// Energie-Schild um einen Gegner (Hexagon-Blase, bricht durch Ionenpuls/EMP).
// Nur Ionen- und EMP-Waffen durchdringen es effektiv — sonst hält es lange.
export function makeEnemyShield(size = 3.0) {
  const m = spritePlane('enemy-shield', 192, 192, size, size, (ctx) => {
    const c = 96;
    // schimmernde Blase
    ctx.fillStyle = rgrad(ctx, c, c, 30, 92, [
      [0, 'rgba(120,235,255,0.05)'], [0.72, 'rgba(90,200,255,0.14)'],
      [0.9, 'rgba(150,235,255,0.55)'], [1, 'rgba(120,235,255,0)'],
    ]);
    ctx.beginPath(); ctx.arc(c, c, 90, 0, Math.PI * 2); ctx.fill();
    // Hexagon-Wabenmuster
    ctx.strokeStyle = 'rgba(190,250,255,0.4)';
    ctx.lineWidth = 2.5;
    for (const [hx, hy] of [[60, 72], [132, 66], [96, 108], [56, 122], [138, 120]]) {
      ctx.beginPath();
      for (let i = 0; i <= 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const px = hx + Math.cos(a) * 15, py = hy + Math.sin(a) * 15;
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
    // heller Glanzbogen
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(c, c, 78, 1.15 * Math.PI, 1.55 * Math.PI); ctx.stroke();
  }, { additive: true });
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
    case 'kryoturm': return buildKryoturm();
    case 'kettenblitz': return buildKettenblitz();
    case 'railkanone': return buildRailkanone();
    default: throw new Error(`Unbekannter Verteidiger-Typ: ${typeId}`);
  }
}

// --- Kryo-Turm: eisige Doppeldüse mit gefrorenem Kern ---
function buildKryoturm() {
  const g = new THREE.Group();
  const card = makeRig(g, 1.25, 3.0);
  const body = spritePlane('def-kryo', 256, 256, 3.4, 3.4, (ctx) => {
    // Fuß
    ctx.fillStyle = lgrad(ctx, 0, 198, 0, 246, [[0, '#456a8c'], [1, '#2b4460']]);
    rr(ctx, 66, 200, 124, 46, 16); ctx.fill(); o(ctx); ctx.stroke();
    // Tank mit Frost-Kern
    ctx.fillStyle = lgrad(ctx, 0, 108, 0, 196, [[0, '#dff6ff'], [1, '#7cc4e6']]);
    rr(ctx, 86, 118, 84, 84, 26); ctx.fill(); o(ctx); ctx.stroke();
    ctx.fillStyle = rgrad(ctx, 128, 158, 4, 40, [[0, '#ffffff'], [0.5, '#b3f0ff'], [1, '#4aa8d8']]);
    ctx.beginPath(); ctx.arc(128, 158, 32, 0, Math.PI * 2); ctx.fill(); o(ctx, 6); ctx.stroke();
    // Eiskristall-Symbol
    ctx.strokeStyle = '#eaffff'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      ctx.save(); ctx.translate(128, 158); ctx.rotate(i * Math.PI / 3);
      ctx.beginPath(); ctx.moveTo(-22, 0); ctx.lineTo(22, 0);
      ctx.moveTo(12, -7); ctx.lineTo(22, 0); ctx.lineTo(12, 7); ctx.stroke();
      ctx.restore();
    }
    // Doppeldüse nach rechts
    ctx.fillStyle = lgrad(ctx, 160, 0, 246, 0, [[0, '#a9dcf0'], [1, '#5a9cc4']]);
    rr(ctx, 168, 128, 78, 24, 10); ctx.fill(); o(ctx); ctx.stroke();
    rr(ctx, 168, 158, 78, 24, 10); ctx.fill(); o(ctx); ctx.stroke();
    ctx.fillStyle = '#eaffff';
    rr(ctx, 236, 132, 10, 16, 4); ctx.fill();
    rr(ctx, 236, 162, 10, 16, 4); ctx.fill();
    // Reif-Glanz
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath(); ctx.ellipse(104, 138, 14, 8, -0.5, 0, Math.PI * 2); ctx.fill();
  });
  body.position.y = 1.7;
  card.add(body);
  const tip = glowDisc('frost', 'rgba(150,230,255,0.9)', 1.0);
  tip.position.set(1.6, 1.55, 0.06);
  card.add(tip);
  const extras = attachDefenderExtras(card, 3.1, 1.7);
  g.userData.muzzleOffset = new THREE.Vector3(1.9, 1.75, 0);
  const phase = Math.random() * Math.PI * 2;
  return {
    group: g, ...extras,
    animate(dt, time) {
      const s = Math.sin(time * 2.3 + phase) * 0.03;
      card.scale.set(1 + s, 1 - s, 1);
      tip.material.opacity = 0.4 + Math.abs(Math.sin(time * 3 + phase)) * 0.4;
    },
  };
}

// --- Kettenblitz: Tesla-Spule mit Bogenlampen-Kugel ---
function buildKettenblitz() {
  const g = new THREE.Group();
  const card = makeRig(g, 1.25, 3.0);
  const body = spritePlane('def-tesla', 256, 256, 3.4, 3.4, (ctx) => {
    // Fuß
    ctx.fillStyle = lgrad(ctx, 0, 198, 0, 246, [[0, '#4a3a6b'], [1, '#2c2148']]);
    rr(ctx, 70, 200, 116, 46, 16); ctx.fill(); o(ctx); ctx.stroke();
    // konische Spule
    ctx.fillStyle = lgrad(ctx, 0, 132, 0, 202, [[0, '#8f7fc0'], [1, '#5a4a8c']]);
    ctx.beginPath();
    ctx.moveTo(104, 200); ctx.lineTo(114, 132); ctx.lineTo(142, 132); ctx.lineTo(152, 200);
    ctx.closePath(); ctx.fill(); o(ctx); ctx.stroke();
    // Kupferwindungen
    ctx.fillStyle = '#c98adf';
    for (const [ry, rw] of [[140, 40], [156, 44], [172, 48], [188, 52]]) {
      rr(ctx, 128 - rw / 2, ry, rw, 8, 4); ctx.fill(); o(ctx, 4); ctx.stroke();
      ctx.fillStyle = '#b388ff';
    }
    // Bogenlampen-Kugel oben
    ctx.fillStyle = rgrad(ctx, 128, 100, 6, 46, [[0, '#ffffff'], [0.45, '#d9b3ff'], [1, '#7a52c8']]);
    ctx.beginPath(); ctx.arc(128, 104, 42, 0, Math.PI * 2); ctx.fill(); o(ctx); ctx.stroke();
    // Mini-Blitze auf der Kugel
    ctx.strokeStyle = '#f0e6ff'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(128, 104); ctx.lineTo(112, 88); ctx.lineTo(120, 84); ctx.lineTo(106, 70); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(128, 104); ctx.lineTo(148, 92); ctx.lineTo(142, 100); ctx.lineTo(160, 90); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(128, 104); ctx.lineTo(132, 82); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath(); ctx.ellipse(114, 90, 12, 7, -0.5, 0, Math.PI * 2); ctx.fill();
  });
  body.position.y = 1.7;
  card.add(body);
  const arc = glowDisc('tesla', 'rgba(179,136,255,0.9)', 1.7);
  arc.position.set(0, 2.35, 0.05);
  card.add(arc);
  const extras = attachDefenderExtras(card, 3.1, 1.7);
  const phase = Math.random() * Math.PI * 2;
  return {
    group: g, ...extras,
    animate(dt, time) {
      const s = Math.sin(time * 2.4 + phase) * 0.03;
      card.scale.set(1 + s, 1 - s, 1);
      arc.material.opacity = 0.3 + Math.abs(Math.sin(time * 7 + phase)) * 0.5;
      arc.scale.setScalar(0.8 + Math.abs(Math.sin(time * 7 + phase)) * 0.3);
    },
  };
}

// --- Railkanone: massiver Schienenlauf auf Drehlafette ---
function buildRailkanone() {
  const g = new THREE.Group();
  const card = makeRig(g, 1.25, 3.1);
  const body = spritePlane('def-rail', 256, 256, 3.7, 3.7, (ctx) => {
    // breiter Fuß mit Streben
    ctx.fillStyle = lgrad(ctx, 0, 200, 0, 248, [[0, '#5a5346'], [1, '#38342b']]);
    ctx.beginPath();
    ctx.moveTo(46, 248); ctx.lineTo(64, 200); ctx.lineTo(192, 200); ctx.lineTo(210, 248);
    ctx.closePath(); ctx.fill(); o(ctx); ctx.stroke();
    // Drehturm-Block
    ctx.fillStyle = lgrad(ctx, 0, 150, 0, 205, [[0, '#8a8172'], [1, '#565043']]);
    rr(ctx, 84, 150, 88, 56, 12); ctx.fill(); o(ctx); ctx.stroke();
    // Energiespeicher-Ringe
    ctx.fillStyle = '#ffb066';
    for (const rx of [96, 120]) { ctx.beginPath(); ctx.arc(rx, 178, 9, 0, Math.PI * 2); ctx.fill(); o(ctx, 4); ctx.stroke(); }
    // Doppel-Schienenlauf weit nach rechts
    ctx.fillStyle = lgrad(ctx, 0, 138, 0, 150, [[0, '#9a9284'], [1, '#655d4e']]);
    rr(ctx, 150, 138, 100, 12, 4); ctx.fill(); o(ctx, 6); ctx.stroke();
    rr(ctx, 150, 168, 100, 12, 4); ctx.fill(); o(ctx, 6); ctx.stroke();
    // glühende Schiene dazwischen
    ctx.fillStyle = lgrad(ctx, 150, 0, 250, 0, [[0, 'rgba(255,176,102,0.3)'], [1, '#ffe0b0']]);
    rr(ctx, 152, 152, 96, 16, 4); ctx.fill();
    ctx.fillStyle = '#fff3e0';
    rr(ctx, 226, 156, 22, 8, 3); ctx.fill();
    // Verstrebung
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = 7; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(170, 150); ctx.lineTo(200, 168); ctx.moveTo(200, 150); ctx.lineTo(170, 168); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.beginPath(); ctx.ellipse(110, 162, 16, 7, -0.2, 0, Math.PI * 2); ctx.fill();
  });
  body.position.y = 1.75;
  card.add(body);
  const tip = glowDisc('rail', 'rgba(255,176,102,0.9)', 1.0);
  tip.position.set(1.7, 1.68, 0.06);
  card.add(tip);
  const extras = attachDefenderExtras(card, 3.3, 1.75);
  g.userData.muzzleOffset = new THREE.Vector3(2.0, 1.7, 0);
  const phase = Math.random() * Math.PI * 2;
  return {
    group: g, ...extras,
    animate(dt, time) {
      const s = Math.sin(time * 1.8 + phase) * 0.025;
      card.scale.set(1 + s, 1 - s, 1);
      tip.material.opacity = 0.35 + Math.abs(Math.sin(time * 2 + phase)) * 0.5;
    },
  };
}

// --- Laserturm: kantige Railgun mit Doppelschiene und Energiezelle ---
function buildLaserturm() {
  const g = new THREE.Group();
  const card = makeRig(g, 1.25, 3.0);

  const body = spritePlane('def-laser3', 256, 256, 3.4, 3.4, (ctx) => {
    // breiter Stufen-Sockel
    ctx.fillStyle = lgrad(ctx, 0, 205, 0, 246, [[0, '#3d5a80'], [1, '#27395c']]);
    ctx.beginPath();
    ctx.moveTo(56, 246); ctx.lineTo(72, 206); ctx.lineTo(184, 206); ctx.lineTo(200, 246);
    ctx.closePath(); ctx.fill(); o(ctx); ctx.stroke();
    ctx.fillStyle = 'rgba(64,224,255,0.6)';
    rr(ctx, 84, 224, 88, 7, 3); ctx.fill();
    // Drehgelenk
    ctx.fillStyle = '#38466b';
    rr(ctx, 104, 182, 48, 28, 10); ctx.fill(); o(ctx); ctx.stroke();
    // Energiezelle hinten links
    ctx.fillStyle = '#12203c';
    rr(ctx, 46, 138, 30, 46, 9); ctx.fill(); o(ctx); ctx.stroke();
    ctx.fillStyle = rgrad(ctx, 61, 160, 2, 22, [[0, '#eaffff'], [0.55, '#40e0ff'], [1, '#1d7fa8']]);
    rr(ctx, 52, 146, 18, 30, 6); ctx.fill();
    // Körper: kantiger Keil
    ctx.fillStyle = lgrad(ctx, 0, 128, 0, 192, [[0, '#7fb0d4'], [1, '#3f6b96']]);
    ctx.beginPath();
    ctx.moveTo(72, 148); ctx.lineTo(150, 134); ctx.lineTo(190, 142);
    ctx.lineTo(190, 176); ctx.lineTo(150, 188); ctx.lineTo(72, 184);
    ctx.closePath(); ctx.fill(); o(ctx); ctx.stroke();
    // Kühlrippen oben
    for (let i = 0; i < 3; i++) {
      const bx = 92 + i * 22;
      ctx.fillStyle = '#2c3c5c';
      ctx.beginPath();
      ctx.moveTo(bx, 136); ctx.lineTo(bx + 12, 134); ctx.lineTo(bx + 8, 116); ctx.lineTo(bx - 4, 118);
      ctx.closePath(); ctx.fill(); o(ctx, 5); ctx.stroke();
    }
    // Akzent-Streifen
    ctx.fillStyle = '#40e0ff';
    rr(ctx, 88, 160, 48, 6, 3); ctx.fill();
    // Railgun-Doppelschiene nach rechts
    ctx.fillStyle = lgrad(ctx, 0, 136, 0, 147, [[0, '#6ea3c4'], [1, '#41729c']]);
    rr(ctx, 182, 136, 62, 11, 5); ctx.fill(); o(ctx, 6); ctx.stroke();
    ctx.fillStyle = lgrad(ctx, 0, 170, 0, 181, [[0, '#6ea3c4'], [1, '#41729c']]);
    rr(ctx, 182, 170, 62, 11, 5); ctx.fill(); o(ctx, 6); ctx.stroke();
    // Energiestrahl zwischen den Schienen
    ctx.fillStyle = lgrad(ctx, 184, 0, 244, 0, [[0, 'rgba(64,224,255,0.25)'], [1, '#bff7ff']]);
    rr(ctx, 186, 150, 56, 17, 6); ctx.fill();
    ctx.fillStyle = '#ffffff';
    rr(ctx, 216, 155, 24, 7, 3); ctx.fill();
    // Mündungs-Flare
    ctx.fillStyle = '#eaffff';
    rr(ctx, 240, 144, 9, 30, 4); ctx.fill(); o(ctx, 5); ctx.stroke();
    // Glanzlinie
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(80, 152); ctx.lineTo(146, 140); ctx.stroke();
  });
  body.position.y = 1.7;
  card.add(body);

  const tip = glowDisc('cyan', 'rgba(64,224,255,0.9)', 1.1);
  tip.position.set(1.58, 1.3, 0.06);
  card.add(tip);

  const extras = attachDefenderExtras(card, 3.1, 1.7);
  g.userData.muzzleOffset = new THREE.Vector3(1.95, 1.65, 0);
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

// --- Plasmakanone: schwere kantige Plasma-Artillerie mit Kondensator-Schlitzen ---
function buildPlasmakanone() {
  const g = new THREE.Group();
  const card = makeRig(g, 1.25, 3.2);

  const body = spritePlane('def-plasma3', 256, 256, 3.6, 3.6, (ctx) => {
    // breiter Fuß
    ctx.fillStyle = lgrad(ctx, 0, 200, 0, 248, [[0, '#5a6b93'], [1, '#38466b']]);
    ctx.beginPath();
    ctx.moveTo(44, 246); ctx.lineTo(62, 202); ctx.lineTo(194, 202); ctx.lineTo(212, 246);
    ctx.closePath(); ctx.fill(); o(ctx); ctx.stroke();
    // Hydraulik-Streben
    for (const [x1, y1, x2, y2] of [[84, 206, 100, 172], [172, 206, 156, 172]]) {
      ctx.strokeStyle = OUTLINE; ctx.lineWidth = 13; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      ctx.strokeStyle = '#8e9ec2'; ctx.lineWidth = 8;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    }
    // Auspuff-Lamellen hinten links
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = '#5f3a78';
      rr(ctx, 52, 112 + i * 20, 20, 10, 4); ctx.fill(); o(ctx, 4); ctx.stroke();
    }
    // Gehäuse: kantiges Achteck
    ctx.fillStyle = lgrad(ctx, 0, 96, 0, 178, [[0, '#f6e6fb'], [0.55, '#dbaee9'], [1, '#a066bd']]);
    ctx.beginPath();
    ctx.moveTo(70, 130); ctx.lineTo(96, 100); ctx.lineTo(160, 96); ctx.lineTo(186, 118);
    ctx.lineTo(186, 158); ctx.lineTo(160, 178); ctx.lineTo(96, 178); ctx.lineTo(70, 154);
    ctx.closePath(); ctx.fill(); o(ctx); ctx.stroke();
    // drei leuchtende Kondensator-Schlitze
    for (let i = 0; i < 3; i++) {
      const sx = 90 + i * 27;
      ctx.fillStyle = '#ff4dd2';
      ctx.beginPath();
      ctx.moveTo(sx, 164); ctx.lineTo(sx + 9, 112); ctx.lineTo(sx + 18, 112); ctx.lineTo(sx + 9, 164);
      ctx.closePath(); ctx.fill(); o(ctx, 4); ctx.stroke();
      ctx.fillStyle = '#ffd9f3';
      ctx.beginPath();
      ctx.moveTo(sx + 5, 152); ctx.lineTo(sx + 11, 124); ctx.lineTo(sx + 14, 124); ctx.lineTo(sx + 8, 152);
      ctx.closePath(); ctx.fill();
    }
    // dicker Lauf mit Segmentringen
    ctx.fillStyle = lgrad(ctx, 0, 112, 0, 166, [[0, '#e6c7f2'], [1, '#a35ec2']]);
    rr(ctx, 178, 112, 70, 54, 16); ctx.fill(); o(ctx); ctx.stroke();
    for (const rx of [192, 214]) {
      ctx.fillStyle = '#8e5aa8';
      rr(ctx, rx, 106, 11, 66, 5); ctx.fill(); o(ctx, 5); ctx.stroke();
    }
    // Mündung mit glühender Ladung
    ctx.fillStyle = '#2c1846';
    ctx.beginPath(); ctx.ellipse(246, 139, 11, 28, 0, 0, Math.PI * 2); ctx.fill(); o(ctx, 6); ctx.stroke();
    ctx.fillStyle = rgrad(ctx, 246, 139, 2, 19, [[0, '#ffffff'], [0.5, '#ff9be4'], [1, 'rgba(255,77,210,0)']]);
    ctx.beginPath(); ctx.ellipse(246, 139, 8, 21, 0, 0, Math.PI * 2); ctx.fill();
    // Glanzlinie
    ctx.strokeStyle = 'rgba(255,255,255,0.65)'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(100, 104); ctx.lineTo(154, 100); ctx.stroke();
  });
  body.position.y = 1.8;
  card.add(body);

  const orb = glowDisc('magenta', 'rgba(255,77,210,0.95)', 1.5);
  orb.position.set(1.66, 1.65, 0.08);
  card.add(orb);

  const extras = attachDefenderExtras(card, 3.3, 1.8);
  g.userData.muzzleOffset = new THREE.Vector3(2.05, 2.0, 0);
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

  const pod = spritePlane('def-traktor3', 256, 256, 2.9, 2.9, (ctx) => {
    // Fuß
    ctx.fillStyle = lgrad(ctx, 0, 190, 0, 246, [[0, '#4c6b9c'], [1, '#31456e']]);
    rr(ctx, 70, 192, 116, 52, 18); ctx.fill(); o(ctx); ctx.stroke();
    // Rumpf
    ctx.fillStyle = lgrad(ctx, 0, 120, 0, 200, [[0, '#b7f0f7'], [1, '#5b93c9']]);
    rr(ctx, 88, 132, 80, 68, 20); ctx.fill(); o(ctx); ctx.stroke();
    // Sensor-Leiste (kantig, ohne Augen-Optik)
    ctx.fillStyle = '#12203c';
    rr(ctx, 98, 150, 60, 16, 8); ctx.fill(); o(ctx, 6); ctx.stroke();
    ctx.fillStyle = '#40e0ff';
    rr(ctx, 104, 155, 34, 6, 3); ctx.fill();
    ctx.fillStyle = '#eaffff';
    rr(ctx, 124, 156, 10, 4, 2); ctx.fill();
    // Lüftungs-Kerben darunter
    ctx.strokeStyle = 'rgba(20,40,80,0.5)'; ctx.lineWidth = 4;
    for (const vx of [106, 122, 138]) {
      ctx.beginPath(); ctx.moveTo(vx, 176); ctx.lineTo(vx + 10, 176); ctx.stroke();
    }
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

  const drone = spritePlane('def-repair-drone3', 256, 160, 2.7, 1.7, (ctx) => {
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
    // Arbeitslicht-Leiste (statt runder Scheinwerfer)
    ctx.fillStyle = '#ffd23f';
    rr(ctx, 112, 114, 32, 8, 4); ctx.fill(); o(ctx, 4); ctx.stroke();
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
    case 'sprengdrohne': return buildSprengdrohne();
    case 'aegisTraeger': return buildAegis();
    case 'phantom': return buildPhantom();
    case 'mutterschiffFragment': return buildMutterschiff();
    default: throw new Error(`Unbekannter Gegner-Typ: ${typeId}`);
  }
}

// ------------------------------------------------------------
// Lexikon-Thumbnails: liefert die Sprite-Zeichnung als Daten-URL
// ------------------------------------------------------------
const THUMB_KEYS = {
  defender: {
    solarkollektor: 'def-solar2', laserturm: 'def-laser3', schildgenerator: 'def-schild2',
    traktorstrahl: 'def-traktor3', plasmakanone: 'def-plasma3', ionenpuls: 'def-ion',
    raketenwerfer: 'def-rakete', reparaturdrohne: 'def-repair-drone3',
  },
  enemy: {
    kleinasteroid: 'en-asteroid', schrottbrocken: 'en-schrott', berstbrocken: 'en-berst',
    alienDrohne: 'en-drohne', schwarmling: 'en-schwarmling', phasenspringer: 'en-phase',
    panzerwalze: 'en-panzer', alienZerstoerer: 'en-zerstoerer', mutterschiffFragment: 'en-boss',
    sprengdrohne: 'en-spreng', aegisTraeger: 'en-aegis', phantom: 'en-phantom',
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

// --- Sprengdrohne: rasende Kamikaze-Kugel mit Warnblinken ---
function buildSprengdrohne() {
  const g = new THREE.Group();
  const card = makeRig(g, 1.2, 2.2);
  const body = spritePlane('en-spreng', 192, 192, 2.1, 2.1, (ctx) => {
    // Stummelflügel
    ctx.fillStyle = '#8a1f2a'; ctx.strokeStyle = OUTLINE; ctx.lineWidth = 6; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(60, 96); ctx.lineTo(24, 74); ctx.lineTo(30, 106); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(132, 96); ctx.lineTo(168, 74); ctx.lineTo(162, 106); ctx.closePath(); ctx.fill(); ctx.stroke();
    // Kugelkörper mit Warnstreifen
    ctx.fillStyle = rgrad(ctx, 90, 90, 8, 56, [[0, '#ff8a6a'], [0.6, '#e0402a'], [1, '#8a1414']]);
    ctx.beginPath(); ctx.arc(96, 100, 48, 0, Math.PI * 2); ctx.fill(); o(ctx); ctx.stroke();
    ctx.save(); ctx.beginPath(); ctx.arc(96, 100, 46, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = '#2b2b33';
    for (let i = -3; i < 5; i++) { ctx.beginPath(); ctx.moveTo(60 + i * 24, 54); ctx.lineTo(76 + i * 24, 54); ctx.lineTo(52 + i * 24, 146); ctx.lineTo(36 + i * 24, 146); ctx.closePath(); ctx.fill(); }
    ctx.restore();
    // blinkendes Warnauge
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath(); ctx.arc(96, 96, 16, 0, Math.PI * 2); ctx.fill(); o(ctx, 6); ctx.stroke();
    ctx.fillStyle = '#8a1414';
    ctx.beginPath(); ctx.arc(96, 96, 7, 0, Math.PI * 2); ctx.fill();
    // Zünder oben
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(96, 52); ctx.lineTo(96, 36); ctx.stroke();
    ctx.fillStyle = '#ff5252'; ctx.beginPath(); ctx.arc(96, 32, 8, 0, Math.PI * 2); ctx.fill(); o(ctx, 4); ctx.stroke();
  });
  body.position.y = 1.1;
  card.add(body);
  const warn = glowDisc('spreng-warn', 'rgba(255,80,50,0.9)', 1.2);
  warn.position.set(0, 1.5, 0.05);
  card.add(warn);
  const phase = Math.random() * Math.PI * 2;
  return {
    group: g,
    animate(dt, time) {
      card.position.y = Math.sin(time * 8 + phase) * 0.12;
      card.rotation.z = Math.sin(time * 6 + phase) * 0.12;
      warn.material.opacity = Math.sin(time * 12 + phase) > 0 ? 0.9 : 0.1; // Warnblinken
    },
  };
}

// --- Aegis-Träger: Support-Alien mit Schutzfeld-Kuppel ---
function buildAegis() {
  const g = new THREE.Group();
  const card = makeRig(g, 1.2, 3.2);
  const body = spritePlane('en-aegis', 256, 256, 3.0, 3.0, (ctx) => {
    // Sockel/Beine
    ctx.fillStyle = '#3a2d5c'; ctx.strokeStyle = OUTLINE; ctx.lineWidth = 8; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(96, 176); ctx.lineTo(70, 220); ctx.lineTo(88, 220); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(160, 176); ctx.lineTo(186, 220); ctx.lineTo(168, 220); ctx.closePath(); ctx.fill(); ctx.stroke();
    // Körper
    ctx.fillStyle = lgrad(ctx, 0, 96, 0, 190, [[0, '#8f6fd0'], [1, '#4d2f8c']]);
    rr(ctx, 78, 96, 100, 92, 30); ctx.fill(); o(ctx); ctx.stroke();
    // Projektor-Kern
    ctx.fillStyle = rgrad(ctx, 128, 138, 4, 34, [[0, '#eaffff'], [0.5, '#7fd8ff'], [1, '#2f7fc8']]);
    ctx.beginPath(); ctx.arc(128, 138, 28, 0, Math.PI * 2); ctx.fill(); o(ctx, 6); ctx.stroke();
    // Schild-Emblem im Kern
    ctx.fillStyle = '#123a5c';
    ctx.beginPath(); ctx.moveTo(128, 122); ctx.lineTo(142, 130); ctx.lineTo(142, 146);
    ctx.quadraticCurveTo(128, 158, 114, 146); ctx.lineTo(114, 130); ctx.closePath(); ctx.fill();
    // Emitter-Antennen
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = 6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(92, 96); ctx.lineTo(78, 66); ctx.moveTo(164, 96); ctx.lineTo(178, 66); ctx.stroke();
    ctx.fillStyle = '#7fd8ff';
    ctx.beginPath(); ctx.arc(76, 62, 8, 0, Math.PI * 2); ctx.fill(); o(ctx, 4); ctx.stroke();
    ctx.beginPath(); ctx.arc(180, 62, 8, 0, Math.PI * 2); ctx.fill(); o(ctx, 4); ctx.stroke();
  });
  body.position.y = 1.5;
  card.add(body);
  // große, halbtransparente Schutzkuppel (zeigt den Schutzradius an)
  const dome = spritePlane('en-aegis-dome', 256, 256, 6.2, 6.2, (ctx) => {
    ctx.fillStyle = rgrad(ctx, 128, 128, 40, 122, [
      [0, 'rgba(120,216,255,0.04)'], [0.8, 'rgba(90,190,255,0.12)'],
      [0.94, 'rgba(150,230,255,0.4)'], [1, 'rgba(120,216,255,0)'],
    ]);
    ctx.beginPath(); ctx.arc(128, 128, 122, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(190,240,255,0.5)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(128, 128, 118, 0, Math.PI * 2); ctx.stroke();
  }, { additive: true });
  dome.position.set(0, 1.6, -0.05);
  g.add(dome);
  const phase = Math.random() * Math.PI * 2;
  let aegisActive = true;
  return {
    group: g,
    setAegisActive(on) { aegisActive = on; dome.visible = on; },
    animate(dt, time) {
      card.position.y = Math.sin(time * 1.6 + phase) * 0.08;
      dome.rotation.z += dt * 0.3;
      dome.material.opacity = 0.7 + Math.sin(time * 2.4 + phase) * 0.2;
    },
  };
}

// --- Phantom: schemenhafter Tarn-Geist ---
function buildPhantom() {
  const g = new THREE.Group();
  const card = makeRig(g, 1.25, 2.5);
  const ghost = spritePlane('en-phantom', 224, 256, 2.6, 2.9, (ctx) => {
    const grd = lgrad(ctx, 0, 40, 0, 236, [
      [0, 'rgba(180,200,255,0.95)'], [0.5, 'rgba(120,130,220,0.8)'], [1, 'rgba(80,60,160,0.3)'],
    ]);
    ctx.fillStyle = grd; ctx.strokeStyle = OUTLINE; ctx.lineWidth = 7; ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(112, 28);
    ctx.quadraticCurveTo(182, 54, 178, 132);
    ctx.quadraticCurveTo(176, 190, 150, 232);
    // gezackter Saum
    ctx.lineTo(132, 210); ctx.lineTo(112, 234); ctx.lineTo(92, 210); ctx.lineTo(74, 232);
    ctx.quadraticCurveTo(48, 190, 46, 132);
    ctx.quadraticCurveTo(42, 54, 112, 28);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    // hohle Augen
    ctx.fillStyle = '#e6ecff';
    ctx.beginPath(); ctx.ellipse(94, 104, 12, 18, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(134, 104, 12, 18, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#5a4a9c';
    ctx.beginPath(); ctx.arc(96, 110, 5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(132, 110, 5, 0, Math.PI * 2); ctx.fill();
    // Phasen-Ringe
    ctx.strokeStyle = 'rgba(190,200,255,0.7)'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.ellipse(112, 150, 66, 12, 0, 0, Math.PI * 2); ctx.stroke();
  });
  ghost.position.y = 1.5;
  card.add(ghost);
  const phase = Math.random() * Math.PI * 2;
  let cloaked = false;
  return {
    group: g,
    setCloak(on) { cloaked = on; },
    animate(dt, time) {
      card.position.y = Math.sin(time * 2.2 + phase) * 0.16;
      // sanft in die Tarnung überblenden
      const target = cloaked ? 0.18 : 1;
      ghost.material.opacity += (target - ghost.material.opacity) * Math.min(1, dt * 6);
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
