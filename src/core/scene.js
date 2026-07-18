// Szenen-Setup im 2D-Cartoon-Look: bunter Nebel-Himmel, Cartoon-Planet mit Ring,
// Schachbrett-Korridore, Warp-Portale am Spawn, glühende Reaktor-Kerne,
// funkelnde Sterne und Sternschnuppen. Alles unbeleuchtet (MeshBasic) für satte Farben.

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { LANES, COLS, CELL_X, laneZ, colX, CORE_X, SPAWN_X } from '../data/config.js';
import { setSpriteCamera, spriteQuaternion, getTexture, spritePlane } from '../entities/meshFactory.js';

// radialer Verlauf als Fill-Style (lokaler Helfer)
function rgrad(ctx, x, y, r0, r1, stops) {
  const g = ctx.createRadialGradient(x, y, r0, x, y, r1);
  for (const [p, c] of stops) g.addColorStop(p, c);
  return g;
}

export function createWorld(container) {
  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(
    46, Math.max(1, window.innerWidth) / Math.max(1, window.innerHeight), 0.1, 400
  );
  camera.position.set(0, 26, 33);
  camera.lookAt(0, 0.5, 2);
  setSpriteCamera(camera); // ab jetzt kennen alle Sprites die Blickrichtung

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.NoToneMapping; // Cartoon-Farben 1:1 wie gezeichnet
  container.appendChild(renderer.domElement);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight), 0.45, 0.55, 0.85
  );
  composer.addPass(bloom);

  // ---------- Level-Themes: jeder Sektor hat eigene Farbstimmung ----------
  const THEMES = [
    { // 0: Sektor Nereon — türkis/indigo (Original-Look)
      sky: ['#241a4e', '#1b2a5e', '#0b3450'],
      blobs: [
        [180, 120, 190, 'rgba(140,80,200,0.22)'], [720, 90, 160, 'rgba(255,90,180,0.14)'],
        [520, 300, 240, 'rgba(60,190,220,0.14)'], [900, 340, 170, 'rgba(120,110,230,0.18)'],
      ],
      planet: ['#a8f0e0', '#4fd0c0', '#2a8fa8', '#1c5f86'],
      ringA: 'rgba(255,190,120,0.9)', ringB: 'rgba(255,120,190,0.55)',
      laneA: '#25688e', laneB: '#153f60',
      rail: 0x11607a, railBright: 0x2f96b8,
    },
    { // 1: Sektor Vortex — magenta/violett
      sky: ['#3a1147', '#3a1a66', '#1b1145'],
      blobs: [
        [200, 140, 200, 'rgba(255,80,180,0.2)'], [760, 100, 180, 'rgba(255,140,80,0.12)'],
        [520, 320, 240, 'rgba(150,70,230,0.2)'], [80, 380, 150, 'rgba(255,90,120,0.12)'],
      ],
      planet: ['#ffd6a8', '#f5a05a', '#c26a4a', '#8a4038'],
      ringA: 'rgba(190,120,255,0.9)', ringB: 'rgba(120,200,255,0.55)',
      laneA: '#5b3a8e', laneB: '#3a2560',
      rail: 0x6a3aa0, railBright: 0xb07ad8,
    },
    { // 2: Sektor Abyss — tiefdunkel mit Glut
      sky: ['#0b0a22', '#141033', '#04121f'],
      blobs: [
        [220, 130, 190, 'rgba(200,60,80,0.16)'], [740, 100, 170, 'rgba(80,60,200,0.16)'],
        [500, 320, 240, 'rgba(40,180,140,0.12)'], [920, 360, 150, 'rgba(160,50,120,0.14)'],
      ],
      planet: ['#c9b0ff', '#7a5ad0', '#4a338f', '#2a1c5c'],
      ringA: 'rgba(255,90,90,0.85)', ringB: 'rgba(255,180,90,0.5)',
      laneA: '#1c5a50', laneB: '#0f3833',
      rail: 0x18705a, railBright: 0x3ecf9a,
    },
  ];

  function skyTexture(themeIndex) {
    const th = THEMES[themeIndex];
    return getTexture(`sky-${themeIndex}`, 1024, 512, (ctx) => {
      const g = ctx.createLinearGradient(0, 0, 0, 512);
      g.addColorStop(0, th.sky[0]);
      g.addColorStop(0.45, th.sky[1]);
      g.addColorStop(1, th.sky[2]);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 1024, 512);
      for (const [x, y, r, c] of th.blobs) {
        const rg = ctx.createRadialGradient(x, y, 10, x, y, r);
        rg.addColorStop(0, c);
        rg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = rg;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      }
      // eingebackene Mini-Sterne
      for (let i = 0; i < 220; i++) {
        const x = Math.random() * 1024, y = Math.random() * 512;
        const r = Math.random() * 1.6 + 0.3;
        ctx.fillStyle = `rgba(255,255,255,${0.25 + Math.random() * 0.55})`;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      }
      // jeder Sektor hat sein eigenes Himmelsobjekt:
      // Nereon = Ringplanet + Mond, Vortex = Wurmloch, Abyss = Schwarzes Loch
      if (themeIndex === 1) {
        drawWormhole(ctx);
      } else if (themeIndex === 2) {
        drawBlackHole(ctx);
      } else {
        drawRingPlanet(ctx, th);
      }
    });
  }

  function drawRingPlanet(ctx, th) {
    const cx = 170, cy = 96, r = 78;
    ctx.save();
    ctx.translate(cx, cy); ctx.rotate(-0.26);
    ctx.strokeStyle = th.ringA; ctx.lineWidth = 13;
    ctx.beginPath(); ctx.ellipse(0, 0, 118, 34, 0, Math.PI * 0.97, Math.PI * 2.03); ctx.stroke();
    ctx.strokeStyle = th.ringB; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.ellipse(0, 0, 118, 34, 0, Math.PI * 0.97, Math.PI * 2.03); ctx.stroke();
    ctx.restore();
    const pg = ctx.createRadialGradient(cx - 26, cy - 30, 8, cx, cy, r + 6);
    pg.addColorStop(0, th.planet[0]);
    pg.addColorStop(0.45, th.planet[1]);
    pg.addColorStop(0.8, th.planet[2]);
    pg.addColorStop(1, th.planet[3]);
    ctx.fillStyle = pg;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#1b2447'; ctx.lineWidth = 5; ctx.stroke();
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, r - 3, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.beginPath(); ctx.ellipse(cx, cy - 30, r + 20, 16, -0.12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(20,30,70,0.25)';
    ctx.beginPath(); ctx.ellipse(cx, cy + 20, r + 20, 14, -0.1, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.20)';
    for (const [fx, fy, fr] of [[140, 70, 12], [205, 60, 8], [185, 130, 10]]) {
      ctx.beginPath(); ctx.arc(fx, fy, fr, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    ctx.save();
    ctx.translate(cx, cy); ctx.rotate(-0.26);
    ctx.strokeStyle = th.ringA; ctx.lineWidth = 13;
    ctx.beginPath(); ctx.ellipse(0, 0, 118, 34, 0, -Math.PI * 0.03, Math.PI * 0.97); ctx.stroke();
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.beginPath(); ctx.ellipse(cx - 34, cy - 40, 20, 9, -0.6, 0, Math.PI * 2); ctx.fill();
    // kleiner Mond daneben
    const mg = ctx.createRadialGradient(320, 180, 3, 328, 186, 22);
    mg.addColorStop(0, '#f4f0ff');
    mg.addColorStop(1, '#9a93c9');
    ctx.fillStyle = mg;
    ctx.beginPath(); ctx.arc(328, 186, 20, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#1b2447'; ctx.lineWidth = 4; ctx.stroke();
    ctx.fillStyle = 'rgba(90,80,140,0.5)';
    ctx.beginPath(); ctx.arc(322, 190, 4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(334, 180, 3, 0, Math.PI * 2); ctx.fill();
  }

  // Sektor Vortex: leuchtendes Wurmloch mit Spiralarmen
  function drawWormhole(ctx) {
    const cx = 185, cy = 110;
    // äußerer Sog-Schein
    const halo = ctx.createRadialGradient(cx, cy, 15, cx, cy, 130);
    halo.addColorStop(0, 'rgba(255,150,240,0.55)');
    halo.addColorStop(0.5, 'rgba(190,90,255,0.28)');
    halo.addColorStop(1, 'rgba(120,50,220,0)');
    ctx.fillStyle = halo;
    ctx.beginPath(); ctx.arc(cx, cy, 130, 0, Math.PI * 2); ctx.fill();
    // Spiralarme
    for (let arm = 0; arm < 3; arm++) {
      const colors = ['rgba(255,140,235,0.9)', 'rgba(140,200,255,0.8)', 'rgba(255,220,140,0.7)'];
      ctx.strokeStyle = colors[arm];
      ctx.lineWidth = 7 - arm;
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (let t = 0; t <= 1; t += 0.04) {
        const ang = arm * (Math.PI * 2 / 3) + t * 4.6;
        const rr = 10 + t * 105;
        const x = cx + Math.cos(ang) * rr;
        const y = cy + Math.sin(ang) * rr * 0.72;
        t === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    // gleißendes Zentrum
    const core = ctx.createRadialGradient(cx, cy, 2, cx, cy, 26);
    core.addColorStop(0, '#ffffff');
    core.addColorStop(0.55, '#ffb8f2');
    core.addColorStop(1, 'rgba(255,120,230,0)');
    ctx.fillStyle = core;
    ctx.beginPath(); ctx.arc(cx, cy, 26, 0, Math.PI * 2); ctx.fill();
    // hineinstürzende Materie-Punkte
    ctx.fillStyle = 'rgba(255,220,250,0.9)';
    for (const [px, py, pr] of [[300, 60, 3], [80, 170, 2.5], [280, 170, 2], [90, 50, 2.5]]) {
      ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2); ctx.fill();
    }
  }

  // Sektor Abyss: Schwarzes Loch mit glühender Akkretionsscheibe
  function drawBlackHole(ctx) {
    const cx = 185, cy = 105;
    // Scheibe hinter dem Loch
    ctx.save();
    ctx.translate(cx, cy); ctx.rotate(-0.18);
    const diskGrad = ctx.createLinearGradient(-120, 0, 120, 0);
    diskGrad.addColorStop(0, 'rgba(255,90,50,0.15)');
    diskGrad.addColorStop(0.5, 'rgba(255,170,80,0.95)');
    diskGrad.addColorStop(1, 'rgba(255,90,50,0.15)');
    ctx.strokeStyle = diskGrad;
    ctx.lineWidth = 16;
    ctx.beginPath(); ctx.ellipse(0, 0, 108, 30, 0, Math.PI * 0.97, Math.PI * 2.03); ctx.stroke();
    ctx.restore();
    // Photonenring + Ereignishorizont
    const glow = ctx.createRadialGradient(cx, cy, 30, cx, cy, 60);
    glow.addColorStop(0, 'rgba(255,180,90,0.9)');
    glow.addColorStop(0.5, 'rgba(255,90,40,0.4)');
    glow.addColorStop(1, 'rgba(255,60,30,0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(cx, cy, 60, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#020208';
    ctx.beginPath(); ctx.arc(cx, cy, 38, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ffcf9a';
    ctx.lineWidth = 3.5;
    ctx.stroke();
    // gravitativ verbogener Lichtbogen oben
    ctx.strokeStyle = 'rgba(255,190,110,0.75)';
    ctx.lineWidth = 6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(cx, cy, 52, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
    // Scheibe vor dem Loch
    ctx.save();
    ctx.translate(cx, cy); ctx.rotate(-0.18);
    ctx.strokeStyle = diskGrad;
    ctx.lineWidth = 16;
    ctx.beginPath(); ctx.ellipse(0, 0, 108, 30, 0, -Math.PI * 0.03, Math.PI * 0.97); ctx.stroke();
    ctx.restore();
    // glühende Funken, die hineingezogen werden
    ctx.fillStyle = 'rgba(255,160,80,0.9)';
    for (const [px, py, pr] of [[305, 80, 2.5], [70, 140, 2], [290, 150, 2], [95, 55, 2.5]]) {
      ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2); ctx.fill();
    }
  }

  scene.background = skyTexture(0);

  // ---------- funkelnde Sterne (zwei Ebenen, gegenphasig) ----------
  // Wichtig: die Kamera schaut steil nach unten — sichtbarer "Himmel" liegt
  // in Weltkoordinaten UNTER y≈0, je weiter weg desto tiefer.
  const starLayers = [];
  for (let layer = 0; layer < 2; layer++) {
    const geo = new THREE.BufferGeometry();
    const n = 160;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const z = -50 - Math.random() * 110;
      const horiz = 33 - z;
      const topY = 26 - horiz * 0.31;
      pos[i * 3] = (Math.random() - 0.5) * horiz * 1.7;
      pos[i * 3 + 1] = topY - Math.random() * horiz * 0.55;
      pos[i * 3 + 2] = z;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color: layer ? 0xbfe8ff : 0xfff3c9, size: layer ? 0.55 : 0.8,
      transparent: true, opacity: 0.8, depthWrite: false,
    });
    const pts = new THREE.Points(geo, mat);
    scene.add(pts);
    starLayers.push(mat);
  }

  // ---------- Korridore: Schachbrett-Böden + leuchtende Ränder ----------
  const laneWidth = 4.5;
  const gridW = COLS * CELL_X;
  const gridCX = (colX(0) + colX(COLS - 1)) / 2;

  function checkerTexture(key, cA, cB, border) {
    return getTexture(key, COLS * 64, 72, (ctx) => {
      for (let i = 0; i < COLS; i++) {
        ctx.fillStyle = i % 2 ? cA : cB;
        ctx.fillRect(i * 64, 0, 64, 72);
        // sanfte Innen-Aufhellung pro Zelle
        const rg = ctx.createRadialGradient(i * 64 + 32, 36, 4, i * 64 + 32, 36, 40);
        rg.addColorStop(0, 'rgba(140,240,255,0.10)');
        rg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = rg;
        ctx.fillRect(i * 64, 0, 64, 72);
      }
      ctx.strokeStyle = border;
      ctx.lineWidth = 3;
      for (let i = 0; i <= COLS; i++) {
        ctx.beginPath(); ctx.moveTo(i * 64, 0); ctx.lineTo(i * 64, 72); ctx.stroke();
      }
      ctx.strokeRect(1.5, 1.5, COLS * 64 - 3, 69);
    });
  }
  function laneTextures(themeIndex) {
    const th = THEMES[themeIndex];
    return [
      checkerTexture(`lane-a-${themeIndex}`, th.laneA, th.laneB, 'rgba(80,225,255,0.55)'),
      checkerTexture(`lane-b-${themeIndex}`, th.laneB, th.laneA, 'rgba(80,225,255,0.55)'),
    ];
  }
  const [texA, texB] = laneTextures(0);

  const railMats = [];
  const portals = [];
  const cores = [];
  const floors = [];

  const approachTex = getTexture('approach', 256, 64, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 256, 0);
    g.addColorStop(0, '#122c4a');
    g.addColorStop(1, '#0d2038');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 64);
  });

  for (let i = 0; i < LANES; i++) {
    const z = laneZ(i);

    // Schachbrett-Boden
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(gridW, laneWidth),
      new THREE.MeshBasicMaterial({ map: i % 2 ? texA : texB })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(gridCX, 0, z);
    scene.add(floor);
    floors.push(floor);

    // Zuläufe links/rechts (dunkler)
    const laneLen = SPAWN_X - CORE_X + 6;
    const approach = new THREE.Mesh(
      new THREE.PlaneGeometry(laneLen, laneWidth),
      new THREE.MeshBasicMaterial({ map: approachTex })
    );
    approach.rotation.x = -Math.PI / 2;
    approach.position.set((SPAWN_X + CORE_X) / 2, -0.05, z);
    scene.add(approach);

    // leuchtende Randstreifen — flach auf dem Boden, damit sie
    // nicht quer durch die Figuren schneiden
    for (const side of [-1, 1]) {
      const railMat = new THREE.MeshBasicMaterial({
        color: 0x11607a, transparent: true, opacity: 0.6, depthWrite: false,
      });
      const rail = new THREE.Mesh(new THREE.PlaneGeometry(laneLen, 0.18), railMat);
      rail.rotation.x = -Math.PI / 2;
      rail.position.set((SPAWN_X + CORE_X) / 2, 0.015, z + side * (laneWidth / 2));
      rail.renderOrder = -3; // Boden-Deko: immer unter den Figuren zeichnen
      scene.add(rail);
      railMats.push(railMat);
    }

    // Warp-Portal am Spawn-Ende
    const portal = spritePlane('portal', 192, 192, 4.4, 4.4, (ctx) => {
      const c = 96;
      const rg = ctx.createRadialGradient(c, c, 12, c, c, 90);
      rg.addColorStop(0, 'rgba(255,255,255,0.9)');
      rg.addColorStop(0.25, 'rgba(255,77,210,0.75)');
      rg.addColorStop(0.6, 'rgba(140,50,220,0.45)');
      rg.addColorStop(1, 'rgba(140,50,220,0)');
      ctx.fillStyle = rg;
      ctx.beginPath(); ctx.arc(c, c, 90, 0, Math.PI * 2); ctx.fill();
      // Wirbel-Arme
      ctx.strokeStyle = 'rgba(255,190,250,0.8)';
      ctx.lineWidth = 7; ctx.lineCap = 'round';
      for (let a = 0; a < 3; a++) {
        ctx.beginPath();
        for (let t = 0; t < 1; t += 0.05) {
          const ang = a * (Math.PI * 2 / 3) + t * 3.2;
          const rr = 14 + t * 68;
          const x = c + Math.cos(ang) * rr, y = c + Math.sin(ang) * rr;
          t === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    }, { additive: true });
    portal.position.set(SPAWN_X + 1.2, 1.9, z);
    portal.quaternion.copy(spriteQuaternion());
    portal.renderOrder = -1; // hinter den Figuren (Gegner kommen "aus" dem Portal)
    scene.add(portal);
    portals.push(portal);

    // Reaktor-Kern (links, zu beschützen)
    const core = spritePlane('core-orb', 160, 160, 2.6, 2.6, (ctx) => {
      const c = 80;
      const rg = ctx.createRadialGradient(c, c, 6, c, c, 74);
      rg.addColorStop(0, '#ffffff');
      rg.addColorStop(0.35, '#7df3ff');
      rg.addColorStop(0.75, 'rgba(35,190,235,0.55)');
      rg.addColorStop(1, 'rgba(35,190,235,0)');
      ctx.fillStyle = rg;
      ctx.beginPath(); ctx.arc(c, c, 74, 0, Math.PI * 2); ctx.fill();
      // Blitz-Symbol im Kern
      ctx.fillStyle = 'rgba(10,60,90,0.85)';
      ctx.beginPath();
      ctx.moveTo(c + 8, c - 30); ctx.lineTo(c - 14, c + 6); ctx.lineTo(c - 2, c + 6);
      ctx.lineTo(c - 8, c + 30); ctx.lineTo(c + 14, c - 6); ctx.lineTo(c + 2, c - 6);
      ctx.closePath(); ctx.fill();
    }, { additive: true });
    core.position.set(CORE_X - 0.6, 1.7, z);
    core.quaternion.copy(spriteQuaternion());
    core.renderOrder = -1;
    scene.add(core);
    cores.push(core);
  }

  // (keine Reaktor-Wand — die pulsierenden Kern-Orbs markieren das Ziel,
  // eine lange Box erzeugt aus dieser Perspektive nur einen störenden Balken)

  // ---------- treibende Deko-Steinchen ----------
  const debris = [];
  for (let i = 0; i < 8; i++) {
    const rock = spritePlane(`deco-rock-${i % 3}`, 96, 96, 1.6 + (i % 3) * 0.5, 1.6 + (i % 3) * 0.5, (ctx) => {
      const bumps = [1, 0.85, 1.05, 0.9, 1.02, 0.88, 1.04, 0.9];
      ctx.fillStyle = '#5a6c96';
      ctx.beginPath();
      for (let k = 0; k <= bumps.length; k++) {
        const a = (k % bumps.length) / bumps.length * Math.PI * 2;
        const r = 34 * bumps[k % bumps.length];
        const x = 48 + Math.cos(a) * r, y = 48 + Math.sin(a) * r;
        k === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#1b2447'; ctx.lineWidth = 6; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.beginPath(); ctx.arc(38, 36, 9, 0, Math.PI * 2); ctx.fill();
    });
    // im sichtbaren Keil über den fernen Lanes platzieren
    rock.position.set(-45 + Math.random() * 95, -9 + Math.random() * 9, -28 - Math.random() * 26);
    rock.quaternion.copy(spriteQuaternion());
    rock.userData.drift = (Math.random() - 0.5) * 0.6;
    rock.userData.spin = (Math.random() - 0.5) * 0.8;
    rock.userData.bobPhase = Math.random() * Math.PI * 2;
    scene.add(rock);
    debris.push(rock);
  }

  // ---------- Sternschnuppe ----------
  const shootingStar = spritePlane('shooting-star', 192, 48, 6, 1.5, (ctx) => {
    const g = ctx.createLinearGradient(0, 24, 192, 24);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.8, 'rgba(160,235,255,0.85)');
    g.addColorStop(1, '#ffffff');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, 24); ctx.lineTo(176, 6); ctx.arc(178, 24, 18, -Math.PI / 2, Math.PI / 2); ctx.lineTo(0, 24);
    ctx.closePath(); ctx.fill();
  }, { additive: true });
  shootingStar.quaternion.copy(spriteQuaternion());
  shootingStar.visible = false;
  scene.add(shootingStar);
  let starTimer = 3;
  let starLife = 0;

  // ---------- Frachter-Konvoi (Deko, zieht gelegentlich vorbei) ----------
  const freighter = spritePlane('freighter', 256, 96, 7.5, 2.8, (ctx) => {
    ctx.strokeStyle = '#1b2447'; ctx.lineWidth = 5; ctx.lineJoin = 'round';
    // Rumpf mit Container-Segmenten
    ctx.fillStyle = '#5b7290';
    rrPath(ctx, 30, 34, 170, 30, 10); ctx.fill(); ctx.stroke();
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = i % 2 ? '#c96f3b' : '#3ecf6a';
      rrPath(ctx, 44 + i * 36, 26, 28, 16, 4); ctx.fill(); ctx.stroke();
    }
    // Cockpit vorn
    ctx.fillStyle = '#8fd8ea';
    rrPath(ctx, 196, 36, 34, 24, 10); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#eaffff';
    ctx.beginPath(); ctx.arc(216, 47, 6, 0, Math.PI * 2); ctx.fill();
    // Triebwerks-Glühen hinten
    const eg = ctx.createLinearGradient(0, 0, 34, 0);
    eg.addColorStop(0, 'rgba(255,200,90,0)');
    eg.addColorStop(1, 'rgba(255,200,90,0.9)');
    ctx.fillStyle = eg;
    ctx.beginPath();
    ctx.moveTo(2, 42); ctx.lineTo(30, 38); ctx.lineTo(30, 58); ctx.lineTo(2, 52);
    ctx.closePath(); ctx.fill();
    // zwei kleine Eskorten-Punkte
    ctx.fillStyle = '#bff3ff';
    ctx.beginPath(); ctx.arc(80, 14, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(150, 82, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  });
  function rrPath(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  freighter.quaternion.copy(spriteQuaternion());
  freighter.visible = false;
  scene.add(freighter);
  let freighterTimer = 14;
  let freighterDir = 1;

  // ---------- Spezialfelder: Energie-Knoten (boost) & Trümmerfelder (blocked) ----------
  const boostTex = getTexture('cell-boost', 192, 192, (ctx) => {
    const c = 96;
    ctx.strokeStyle = 'rgba(255,210,63,0.9)'; ctx.lineWidth = 8; ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let i = 0; i <= 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
      const x = c + Math.cos(a) * 74, y = c + Math.sin(a) * 74;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.fillStyle = rgrad(ctx, c, c, 8, 74, [
      [0, 'rgba(255,235,150,0.5)'], [0.6, 'rgba(255,200,60,0.22)'], [1, 'rgba(255,180,50,0)'],
    ]);
    ctx.beginPath(); ctx.arc(c, c, 74, 0, Math.PI * 2); ctx.fill();
    // Blitz-Symbol
    ctx.fillStyle = '#fff3b0';
    ctx.beginPath();
    ctx.moveTo(c + 10, c - 34); ctx.lineTo(c - 16, c + 6); ctx.lineTo(c - 3, c + 6);
    ctx.lineTo(c - 10, c + 36); ctx.lineTo(c + 18, c - 8); ctx.lineTo(c + 3, c - 8);
    ctx.closePath(); ctx.fill();
  }, { additive: true });

  const blockedTex = getTexture('cell-blocked', 192, 192, (ctx) => {
    // Trümmerhaufen (blockiert das Feld)
    const bumps = [1, 0.8, 1.05, 0.85, 1.1, 0.82, 1.02, 0.88];
    for (const [bx, by, br, fill] of [[80, 112, 44, '#5a564c'], [122, 96, 32, '#6d685c'], [96, 132, 26, '#47433b']]) {
      ctx.save(); ctx.translate(bx, by);
      ctx.beginPath();
      for (let k = 0; k <= bumps.length; k++) {
        const a = (k % bumps.length) / bumps.length * Math.PI * 2;
        const rr2 = br * bumps[k % bumps.length];
        k === 0 ? ctx.moveTo(Math.cos(a) * rr2, Math.sin(a) * rr2) : ctx.lineTo(Math.cos(a) * rr2, Math.sin(a) * rr2);
      }
      ctx.closePath();
      ctx.fillStyle = fill; ctx.fill();
      ctx.strokeStyle = '#1b2447'; ctx.lineWidth = 6; ctx.lineJoin = 'round'; ctx.stroke();
      ctx.restore();
    }
    // Warn-Kreuz
    ctx.strokeStyle = 'rgba(255,90,90,0.85)'; ctx.lineWidth = 7; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(70, 74); ctx.lineTo(122, 126); ctx.moveTo(122, 74); ctx.lineTo(70, 126); ctx.stroke();
  });

  const specialGroup = new THREE.Group();
  scene.add(specialGroup);
  const boostMeshes = [];
  function setSpecialCells(cells) {
    while (specialGroup.children.length) specialGroup.remove(specialGroup.children[0]);
    boostMeshes.length = 0;
    for (const cell of cells ?? []) {
      const x = colX(cell.col), z = laneZ(cell.lane);
      if (cell.type === 'boost') {
        const m = new THREE.Mesh(
          new THREE.PlaneGeometry(CELL_X - 0.4, 3.8),
          new THREE.MeshBasicMaterial({ map: boostTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })
        );
        m.rotation.x = -Math.PI / 2;
        m.position.set(x, 0.04, z);
        m.renderOrder = -2;
        specialGroup.add(m);
        boostMeshes.push(m);
      } else if (cell.type === 'blocked') {
        const m = new THREE.Mesh(
          new THREE.PlaneGeometry(3.2, 3.2),
          new THREE.MeshBasicMaterial({ map: blockedTex, transparent: true, depthWrite: false })
        );
        m.position.set(x, 1.2, z);
        m.quaternion.copy(spriteQuaternion());
        specialGroup.add(m);
      }
    }
  }

  // ---------- driftende Nebelschwaden (Tiefe & Atmosphäre) ----------
  const nebulae = [];
  const nebulaColors = ['rgba(120,80,220,', 'rgba(60,190,220,', 'rgba(255,90,180,', 'rgba(70,220,190,'];
  for (let i = 0; i < 4; i++) {
    const col = nebulaColors[i % nebulaColors.length];
    const neb = spritePlane(`nebula-${i}`, 256, 256, 40 + i * 8, 34 + i * 6, (ctx) => {
      for (let b = 0; b < 5; b++) {
        const x = 60 + Math.random() * 136, y = 60 + Math.random() * 136;
        const r = 40 + Math.random() * 70;
        const g = ctx.createRadialGradient(x, y, 4, x, y, r);
        g.addColorStop(0, col + '0.10)');
        g.addColorStop(1, col + '0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      }
    }, { additive: true });
    neb.position.set(-40 + Math.random() * 80, -12 - Math.random() * 6, -60 - i * 12);
    neb.quaternion.copy(spriteQuaternion());
    neb.material.opacity = 0.5;
    neb.userData.drift = 0.25 + Math.random() * 0.4;
    neb.userData.phase = Math.random() * Math.PI * 2;
    scene.add(neb);
    nebulae.push(neb);
  }

  // ---------- Vordergrund-Sternenstaub (Parallaxe nahe der Kamera) ----------
  const dustGeo = new THREE.BufferGeometry();
  const dustN = 90;
  const dustPos = new Float32Array(dustN * 3);
  for (let i = 0; i < dustN; i++) {
    dustPos[i * 3] = (Math.random() - 0.5) * 70;
    dustPos[i * 3 + 1] = 2 + Math.random() * 20;
    dustPos[i * 3 + 2] = 8 + Math.random() * 24;
  }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
    color: 0xbfe8ff, size: 0.35, transparent: true, opacity: 0.5, depthWrite: false,
  }));
  scene.add(dust);

  // ---------- animiertes Himmelsobjekt als Weltobjekt (dreht/kreist) ----------
  function skyAccentTexture(themeIndex) {
    return getTexture(`sky-accent-${themeIndex}`, 256, 256, (ctx) => {
      const c = 128;
      if (themeIndex === 1) {
        // Wurmloch-Spirale
        for (let arm = 0; arm < 3; arm++) {
          ctx.strokeStyle = ['rgba(255,140,235,0.9)', 'rgba(140,200,255,0.8)', 'rgba(255,220,140,0.7)'][arm];
          ctx.lineWidth = 8 - arm * 1.5; ctx.lineCap = 'round';
          ctx.beginPath();
          for (let t = 0; t <= 1; t += 0.03) {
            const ang = arm * (Math.PI * 2 / 3) + t * 4.8;
            const r = 8 + t * 110;
            const x = c + Math.cos(ang) * r, y = c + Math.sin(ang) * r;
            t === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
        const core = rgrad(ctx, c, c, 2, 28, [[0, '#fff'], [0.55, '#ffb8f2'], [1, 'rgba(255,120,230,0)']]);
        ctx.fillStyle = core; ctx.beginPath(); ctx.arc(c, c, 28, 0, Math.PI * 2); ctx.fill();
      } else if (themeIndex === 2) {
        // Akkretionsscheibe
        ctx.save(); ctx.translate(c, c);
        const disk = ctx.createLinearGradient(-116, 0, 116, 0);
        disk.addColorStop(0, 'rgba(255,90,50,0.1)'); disk.addColorStop(0.5, 'rgba(255,170,80,0.95)'); disk.addColorStop(1, 'rgba(255,90,50,0.1)');
        ctx.strokeStyle = disk; ctx.lineWidth = 20;
        ctx.beginPath(); ctx.ellipse(0, 0, 108, 34, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
        ctx.fillStyle = '#050208'; ctx.beginPath(); ctx.arc(c, c, 40, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(255,200,120,0.9)'; ctx.lineWidth = 4; ctx.stroke();
      } else {
        // Mond mit Kratern
        const mg = rgrad(ctx, c - 24, c - 24, 6, 100, [[0, '#f4f0ff'], [1, '#9a93c9']]);
        ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(c, c, 88, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#1b2447'; ctx.lineWidth = 6; ctx.stroke();
        ctx.fillStyle = 'rgba(90,80,140,0.5)';
        for (const [kx, ky, kr] of [[100, 150, 20], [150, 100, 14], [140, 165, 11], [80, 90, 12]]) {
          ctx.beginPath(); ctx.arc(kx, ky, kr, 0, Math.PI * 2); ctx.fill();
        }
      }
    }, { additive: themeIndex !== 0 });
  }
  const skyAccent = new THREE.Mesh(
    new THREE.PlaneGeometry(16, 16),
    new THREE.MeshBasicMaterial({ map: skyAccentTexture(0), transparent: true, depthWrite: false })
  );
  skyAccent.position.set(-34, -4, -56);
  skyAccent.quaternion.copy(spriteQuaternion());
  scene.add(skyAccent);
  let skyAccentSpin = 0; // 0 = Mond (bob), sonst Rotation

  // Unsichtbare Ebene fürs Maus-Picking
  const pickPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(300, 300),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  pickPlane.rotation.x = -Math.PI / 2;
  scene.add(pickPlane);

  // ---------- Resize (auch pro Frame geprüft, falls mit 0×0 geladen) ----------
  function applySize() {
    const w = Math.max(1, window.innerWidth);
    const h = Math.max(1, window.innerHeight);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    composer.setSize(w, h);
  }
  window.addEventListener('resize', applySize);
  applySize();

  // ---------- Umgebungs-Animation ----------
  // bewusst gedeckte Töne: helle Streifen würden per Bloom über die Figuren strahlen
  const railBase = new THREE.Color(0x11607a);
  const railBright = new THREE.Color(0x2f96b8);

  // Theme wechseln (pro Level): Himmel, Lane-Farben, Streifen-Farben, Himmelsobjekt
  function applyTheme(themeIndex) {
    const i = themeIndex % THEMES.length;
    scene.background = skyTexture(i);
    const [a, b] = laneTextures(i);
    floors.forEach((floor, k) => {
      floor.material.map = k % 2 ? a : b;
      floor.material.needsUpdate = true;
    });
    railBase.set(THEMES[i].rail);
    railBright.set(THEMES[i].railBright);
    // animiertes Himmelsobjekt passend zum Sektor
    skyAccent.material.map = skyAccentTexture(i);
    skyAccent.material.blending = i === 0 ? THREE.NormalBlending : THREE.AdditiveBlending;
    skyAccent.material.needsUpdate = true;
    skyAccentSpin = i === 0 ? 0 : (i === 1 ? 0.5 : 0.28); // Mond ruht, Wurmloch/Loch drehen
    skyAccent.rotation.z = 0;
  }

  function updateEnvironment(dt, time) {
    const size = renderer.getSize(new THREE.Vector2());
    if (size.x !== window.innerWidth || size.y !== window.innerHeight) applySize();

    // Sterne funkeln gegenphasig
    starLayers[0].opacity = 0.55 + Math.sin(time * 1.7) * 0.3;
    starLayers[1].opacity = 0.55 + Math.cos(time * 2.1) * 0.3;

    // Randstreifen pulsieren, gelegentliches Flackern
    const pulse = 0.5 + 0.5 * Math.sin(time * 2.3);
    const flicker = Math.random() < 0.012 ? 0.5 : 0;
    for (const m of railMats) {
      m.color.copy(railBase).lerp(railBright, Math.min(1, pulse * 0.55 + flicker));
    }

    // Portale wirbeln und atmen
    for (let i = 0; i < portals.length; i++) {
      const p = portals[i];
      p.rotation.z -= dt * (1.4 + i * 0.13);
      const s = 1 + Math.sin(time * 2.2 + i * 1.3) * 0.08;
      p.scale.setScalar(s);
    }

    // Reaktor-Kerne pochen
    for (let i = 0; i < cores.length; i++) {
      const c = cores[i];
      const s = 1 + Math.sin(time * 3 + i * 0.9) * 0.1;
      c.scale.setScalar(s);
      c.material.opacity = 0.8 + Math.sin(time * 3 + i * 0.9) * 0.2;
    }

    // Deko-Steinchen treiben
    for (const rock of debris) {
      rock.position.x += rock.userData.drift * dt;
      rock.rotation.z += rock.userData.spin * dt;
      rock.position.y += Math.sin(time * 0.8 + rock.userData.bobPhase) * dt * 0.3;
      if (rock.position.x > 75) rock.position.x = -65;
      if (rock.position.x < -65) rock.position.x = 75;
    }

    // Nebelschwaden driften und atmen
    for (const neb of nebulae) {
      neb.position.x += neb.userData.drift * dt;
      neb.material.opacity = 0.4 + Math.sin(time * 0.3 + neb.userData.phase) * 0.18;
      if (neb.position.x > 55) neb.position.x = -55;
    }

    // Vordergrund-Sternenstaub sinkt langsam (Parallaxe)
    const dp = dust.geometry.attributes.position;
    for (let i = 0; i < dp.count; i++) {
      let y = dp.getY(i) - dt * 1.2;
      let x = dp.getX(i) + dt * 0.6;
      if (y < 1) { y = 22; x = (Math.random() - 0.5) * 70; }
      dp.setY(i, y); dp.setX(i, x);
    }
    dp.needsUpdate = true;
    dust.material.opacity = 0.4 + Math.sin(time * 1.3) * 0.15;

    // Energie-Knoten-Felder pulsieren golden
    for (const m of boostMeshes) {
      m.material.opacity = 0.55 + Math.sin(time * 2.6) * 0.3;
    }

    // Himmelsobjekt: Mond wippt sanft, Wurmloch/Schwarzes Loch rotieren
    if (skyAccentSpin > 0) {
      skyAccent.rotation.z += dt * skyAccentSpin;
    } else {
      skyAccent.position.y = -4 + Math.sin(time * 0.35) * 1.2;
      skyAccent.position.x = -34 + Math.cos(time * 0.35) * 1.5;
    }

    // Frachter-Konvoi zieht langsam vorbei
    if (freighter.visible) {
      freighter.position.x += dt * 4.5 * freighterDir;
      if (Math.abs(freighter.position.x) > 60) freighter.visible = false;
    } else {
      freighterTimer -= dt;
      if (freighterTimer <= 0) {
        freighterTimer = 24 + Math.random() * 22;
        freighterDir = Math.random() < 0.5 ? 1 : -1;
        freighter.position.set(-58 * freighterDir, -5 - Math.random() * 5, -48 - Math.random() * 15);
        freighter.scale.x = freighterDir; // Blickrichtung spiegeln
        freighter.visible = true;
      }
    }

    // Sternschnuppe
    if (shootingStar.visible) {
      starLife -= dt;
      shootingStar.position.x -= dt * 40;
      shootingStar.position.y -= dt * 7;
      shootingStar.material.opacity = Math.max(0, Math.min(1, starLife));
      if (starLife <= 0) shootingStar.visible = false;
    } else {
      starTimer -= dt;
      if (starTimer <= 0) {
        starTimer = 4 + Math.random() * 7;
        starLife = 1.4;
        // im sichtbaren Keil starten (oben rechts im Bild)
        shootingStar.position.set(25 + Math.random() * 30, -4 - Math.random() * 4, -55);
        shootingStar.rotation.z = 0.2;
        shootingStar.visible = true;
      }
    }
  }

  return { scene, camera, renderer, composer, pickPlane, updateEnvironment, applyTheme, setSpecialCells };
}
