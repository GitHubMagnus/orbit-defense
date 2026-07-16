// Szenen-Setup im 2D-Cartoon-Look: bunter Nebel-Himmel, Cartoon-Planet mit Ring,
// Schachbrett-Korridore, Warp-Portale am Spawn, glühende Reaktor-Kerne,
// funkelnde Sterne und Sternschnuppen. Alles unbeleuchtet (MeshBasic) für satte Farben.

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { LANES, COLS, CELL_X, laneZ, colX, CORE_X, SPAWN_X } from '../data/config.js';
import { setSpriteCamera, spriteQuaternion, getTexture, spritePlane } from '../entities/meshFactory.js';

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

  // ---------- Nebel-Himmel als Hintergrund (mit eingebackenem Planeten) ----------
  scene.background = getTexture('sky', 1024, 512, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0, '#241a4e');
    g.addColorStop(0.45, '#1b2a5e');
    g.addColorStop(1, '#0b3450');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1024, 512);
    // weiche Nebel-Blasen
    const blobs = [
      [180, 120, 190, 'rgba(140,80,200,0.22)'],
      [720, 90, 160, 'rgba(255,90,180,0.14)'],
      [520, 300, 240, 'rgba(60,190,220,0.14)'],
      [900, 340, 170, 'rgba(120,110,230,0.18)'],
      [90, 380, 150, 'rgba(70,220,190,0.12)'],
    ];
    for (const [x, y, r, c] of blobs) {
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
    // Cartoon-Planet Nereon mit Ring (oben links)
    const cx = 170, cy = 96, r = 78;
    ctx.save();
    ctx.translate(cx, cy); ctx.rotate(-0.26);
    ctx.strokeStyle = 'rgba(255,190,120,0.9)'; ctx.lineWidth = 13;
    ctx.beginPath(); ctx.ellipse(0, 0, 118, 34, 0, Math.PI * 0.97, Math.PI * 2.03); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,120,190,0.55)'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.ellipse(0, 0, 118, 34, 0, Math.PI * 0.97, Math.PI * 2.03); ctx.stroke();
    ctx.restore();
    const pg = ctx.createRadialGradient(cx - 26, cy - 30, 8, cx, cy, r + 6);
    pg.addColorStop(0, '#a8f0e0');
    pg.addColorStop(0.45, '#4fd0c0');
    pg.addColorStop(0.8, '#2a8fa8');
    pg.addColorStop(1, '#1c5f86');
    ctx.fillStyle = pg;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#1b2447'; ctx.lineWidth = 5; ctx.stroke();
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, r - 3, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.beginPath(); ctx.ellipse(cx, cy - 30, r + 20, 16, -0.12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(20,60,110,0.22)';
    ctx.beginPath(); ctx.ellipse(cx, cy + 20, r + 20, 14, -0.1, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.20)';
    for (const [fx, fy, fr] of [[140, 70, 12], [205, 60, 8], [185, 130, 10]]) {
      ctx.beginPath(); ctx.arc(fx, fy, fr, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    ctx.save();
    ctx.translate(cx, cy); ctx.rotate(-0.26);
    ctx.strokeStyle = 'rgba(255,205,130,0.95)'; ctx.lineWidth = 13;
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
  });

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
  const texA = checkerTexture('lane-a', '#25688e', '#153f60', 'rgba(80,225,255,0.55)');
  const texB = checkerTexture('lane-b', '#153f60', '#25688e', 'rgba(80,225,255,0.55)');

  const railMats = [];
  const portals = [];
  const cores = [];

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

  return { scene, camera, renderer, composer, pickPlane, updateEnvironment };
}
