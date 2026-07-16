// HTML/CSS-Overlay: Einheiten-Leiste, Ressourcen, Integrität, Wellen, Screens.

import { DEFENDER_TYPES, DEFENDER_ORDER } from '../data/defenders.js';
import { START_INTEGRITY } from '../data/config.js';

// Cartoon-SVG-Icons pro Einheit (passend zu den 2D-Sprites, mit Gesichtern)
const ICONS = {
  solarkollektor: `<svg viewBox="0 0 40 40"><defs><linearGradient id="gSolCell" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3f8fe8"/><stop offset="1" stop-color="#123f8f"/></linearGradient></defs>
    <g stroke="#1b2447" stroke-width="1.6" stroke-linejoin="round">
    <rect x="11" y="30" width="18" height="6" rx="3" fill="#31456e"/>
    <rect x="18.6" y="20" width="2.8" height="11" rx="1.4" fill="#8fa8c9"/>
    <g transform="rotate(-14 20 12.5)">
      <rect x="4" y="4.5" width="32" height="16" rx="2.5" fill="#f5a623"/>
      <rect x="6.5" y="7" width="27" height="11" rx="1.5" fill="url(#gSolCell)"/>
    </g></g>
    <g transform="rotate(-14 20 12.5)" stroke="rgba(225,242,255,0.75)" stroke-width="1.1">
      <line x1="15.5" y1="7" x2="15.5" y2="18"/>
      <line x1="24.5" y1="7" x2="24.5" y2="18"/>
      <line x1="6.5" y1="12.5" x2="33.5" y2="12.5"/>
    </g>
    <g transform="rotate(-14 20 12.5)">
      <polygon points="10,7 14,7 9,18 6.5,18 6.5,14" fill="rgba(255,255,255,0.4)"/>
    </g>
    <rect x="14" y="31.5" width="3" height="3" rx="0.8" fill="#aefc4b"/>
    <rect x="18.5" y="31.5" width="3" height="3" rx="0.8" fill="#aefc4b"/>
    <rect x="23" y="31.5" width="3" height="3" rx="0.8" fill="rgba(174,252,75,0.3)"/></svg>`,
  laserturm: `<svg viewBox="0 0 40 40"><defs><radialGradient id="gLasP" cx="0.4" cy="0.35" r="0.9"><stop offset="0" stop-color="#d9fbff"/><stop offset="1" stop-color="#2fa3c9"/></radialGradient></defs>
    <g stroke="#1b2447" stroke-width="1.6" stroke-linejoin="round">
    <rect x="10" y="30" width="20" height="6" rx="3" fill="#3d5a80"/>
    <rect x="15" y="20" width="10" height="11" rx="3" fill="#6fa8c9"/>
    <rect x="21" y="11" width="14" height="7" rx="3.5" fill="#4a86ad"/>
    <circle cx="16" cy="14" r="9" fill="url(#gLasP)"/></g>
    <rect x="10" y="10.5" width="12" height="7" rx="3.5" fill="#173056"/>
    <circle cx="17" cy="14" r="2.6" fill="#fff"/><circle cx="18" cy="14" r="1.3" fill="#1b2447"/>
    <circle cx="36" cy="14.5" r="2.6" fill="#7df3ff"/></svg>`,
  schildgenerator: `<svg viewBox="0 0 40 40">
    <circle cx="20" cy="18" r="16" fill="rgba(80,215,255,0.22)" stroke="rgba(190,250,255,0.9)" stroke-width="1.8"/>
    <g stroke="#1b2447" stroke-width="1.6" stroke-linejoin="round">
    <rect x="13" y="14" width="14" height="15" rx="4" fill="#7fc8e8"/>
    <rect x="14.5" y="28" width="4.5" height="4" rx="1.5" fill="#2d4b74"/><rect x="21" y="28" width="4.5" height="4" rx="1.5" fill="#2d4b74"/>
    <circle cx="20" cy="9.5" r="2.2" fill="#40e0ff"/></g>
    <line x1="20" y1="14" x2="20" y2="11" stroke="#1b2447" stroke-width="1.6"/>
    <circle cx="17" cy="19" r="1.5" fill="#fff" stroke="#1b2447" stroke-width="0.8"/><circle cx="23" cy="19" r="1.5" fill="#fff" stroke="#1b2447" stroke-width="0.8"/>
    <path d="M17.5 23 Q20 25 22.5 23" fill="none" stroke="#1b2447" stroke-width="1.4" stroke-linecap="round"/></svg>`,
  traktorstrahl: `<svg viewBox="0 0 40 40"><defs><linearGradient id="gTrkP" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="rgba(120,255,220,0.7)"/><stop offset="1" stop-color="rgba(90,220,255,0)"/></linearGradient></defs>
    <polygon points="20,24 6,2 34,2" fill="url(#gTrkP)"/>
    <g stroke="#1b2447" stroke-width="1.6" stroke-linejoin="round">
    <path d="M8 14 Q20 24 32 14 Q20 18 8 14 Z" fill="#bfeef7"/>
    <rect x="14" y="21" width="12" height="10" rx="3" fill="#7fb8dd"/>
    <rect x="11" y="30" width="18" height="6" rx="3" fill="#31456e"/></g>
    <circle cx="20" cy="26" r="2.4" fill="#fff" stroke="#1b2447" stroke-width="1"/><circle cx="20" cy="25.4" r="1.2" fill="#1b2447"/></svg>`,
  plasmakanone: `<svg viewBox="0 0 40 40"><defs><radialGradient id="gPlaP" cx="0.38" cy="0.35" r="0.95"><stop offset="0" stop-color="#ffffff"/><stop offset="0.55" stop-color="#f3e0fa"/><stop offset="1" stop-color="#c58ad6"/></radialGradient><radialGradient id="gPlaOrb" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#fff"/><stop offset="0.55" stop-color="#ff9be4"/><stop offset="1" stop-color="rgba(255,77,210,0)"/></radialGradient></defs>
    <g stroke="#1b2447" stroke-width="1.6" stroke-linejoin="round">
    <rect x="8" y="30" width="20" height="6" rx="3" fill="#38466b"/>
    <rect x="22" y="14" width="13" height="9" rx="4" fill="#c58ad6"/>
    <circle cx="15" cy="19" r="11.5" fill="url(#gPlaP)"/>
    <circle cx="14" cy="18" r="5.5" fill="#2c1846"/></g>
    <circle cx="14" cy="18" r="3.6" fill="#ff9be4"/>
    <circle cx="12.6" cy="16.6" r="1.2" fill="#fff"/>
    <circle cx="36" cy="18.5" r="4" fill="url(#gPlaOrb)"/></svg>`,
  ionenpuls: `<svg viewBox="0 0 40 40"><defs><radialGradient id="gIonP" cx="0.42" cy="0.38" r="0.9"><stop offset="0" stop-color="#ffffff"/><stop offset="0.5" stop-color="#7df3ff"/><stop offset="1" stop-color="#2fa3c9"/></radialGradient></defs>
    <g stroke="#1b2447" stroke-width="1.6" stroke-linejoin="round">
    <rect x="10" y="31" width="20" height="5" rx="2.5" fill="#31456e"/>
    <polygon points="16,20 24,20 22.5,31 17.5,31" fill="#5b7290"/>
    <rect x="14.5" y="21.5" width="11" height="2.6" rx="1.3" fill="#ffb300"/>
    <rect x="15.5" y="25.5" width="9" height="2.6" rx="1.3" fill="#ffb300"/>
    <circle cx="20" cy="12" r="8" fill="url(#gIonP)"/></g>
    <path d="M21.5 8 L17.5 13 L20 13 L18.5 17 L23 11.5 L20.5 11.5 Z" fill="#0a3c5a"/>
    <path d="M8 6 L11 9 M32 6 L29 9 M20 1.5 L20 4" fill="none" stroke="#bff3ff" stroke-width="1.6" stroke-linecap="round"/></svg>`,
  raketenwerfer: `<svg viewBox="0 0 40 40">
    <g stroke="#1b2447" stroke-width="1.6" stroke-linejoin="round">
    <rect x="7" y="31" width="26" height="5" rx="2.5" fill="#38466b"/>
    <rect x="10" y="22" width="18" height="10" rx="3" fill="#5b7290"/>
    <g transform="rotate(-32 26 18)">
      <rect x="21" y="6" width="10" height="20" rx="3" fill="#4a628f"/>
      <rect x="23" y="1" width="6" height="8" rx="2" fill="#f2f6ff"/>
      <polygon points="23,2 26,-3.5 29,2" fill="#ff5252"/>
    </g></g>
    <circle cx="12" cy="20" r="2.2" fill="#40e0ff" stroke="#1b2447" stroke-width="1.2"/></svg>`,
  reparaturdrohne: `<svg viewBox="0 0 40 40">
    <g stroke="#1b2447" stroke-width="1.6" stroke-linejoin="round">
    <rect x="6" y="31" width="28" height="5" rx="2.5" fill="#31456e"/>
    <ellipse cx="8" cy="12" rx="6" ry="2" fill="rgba(190,230,255,0.6)"/>
    <ellipse cx="32" cy="12" rx="6" ry="2" fill="rgba(190,230,255,0.6)"/>
    <rect x="13" y="14" width="14" height="11" rx="4" fill="#eafff2"/></g>
    <line x1="13" y1="16" x2="8" y2="13" stroke="#1b2447" stroke-width="1.6"/>
    <line x1="27" y1="16" x2="32" y2="13" stroke="#1b2447" stroke-width="1.6"/>
    <rect x="18.4" y="15.5" width="3.2" height="8" rx="1" fill="#3ecf6a"/>
    <rect x="16" y="17.9" width="8" height="3.2" rx="1" fill="#3ecf6a"/></svg>`,
};

// Recycler-Werkzeug (Abriss mit Teilrückerstattung) — PvZ-Schaufel-Äquivalent
const RECYCLER_ICON = `<svg viewBox="0 0 40 40">
  <g fill="none" stroke="#3ecf6a" stroke-width="3.4" stroke-linecap="round">
  <path d="M20 7 A 13 13 0 1 1 8.5 13.5"/>
  </g>
  <polygon points="8.5,5.5 8.5,17 16.5,11" fill="#3ecf6a"/>
  <path d="M14 24 L26 24 M16 24 L17 31 M24 24 L23 31" stroke="#ff8a5c" stroke-width="2.6" stroke-linecap="round" fill="none"/></svg>`;

// gelber Energie-Blitz als Währungssymbol
const boltSvg = `<svg viewBox="0 0 24 24"><polygon points="14,1 5,13 10.5,13 8,23 19,9.5 12.5,9.5 16,1" fill="#ffd23f" stroke="#7a4d00" stroke-width="1.4" stroke-linejoin="round"/></svg>`;

export class HUD {
  constructor(callbacks) {
    this.cb = callbacks; // { onSelectUnit(typeId|null), onStartLevel(i), onRestart() }
    this.selectedType = null;
    this.cards = {};

    this.el = {
      hud: document.getElementById('hud'),
      energy: document.getElementById('energy-value'),
      waveLabel: document.getElementById('wave-label'),
      integrity: document.getElementById('integrity-segments'),
      banner: document.getElementById('wave-banner'),
      bottomBar: document.getElementById('bottom-bar'),
      tooltip: document.getElementById('tooltip'),
      startScreen: document.getElementById('start-screen'),
      gameoverScreen: document.getElementById('gameover-screen'),
      gameoverStats: document.getElementById('gameover-stats'),
      winScreen: document.getElementById('win-screen'),
      buildMenu: document.getElementById('build-menu'),
    };

    this.buildIntegrity();
    this.buildUnitBar();
    this.bannerTimeout = null;

    document.querySelectorAll('.level-btn[data-level]').forEach((btn) => {
      btn.addEventListener('click', () => this.cb.onStartLevel(Number(btn.dataset.level)));
    });
    document.getElementById('retry-btn').addEventListener('click', () => this.cb.onRestart());
    document.getElementById('win-restart-btn').addEventListener('click', () => this.cb.onRestart());
    document.querySelectorAll('.to-level-select').forEach((btn) => {
      btn.addEventListener('click', () => this.cb.onLevelSelect());
    });
  }

  buildIntegrity() {
    this.el.integrity.innerHTML = '';
    this.segs = [];
    for (let i = 0; i < START_INTEGRITY; i++) {
      const seg = document.createElement('div');
      seg.className = 'integrity-seg';
      this.el.integrity.appendChild(seg);
      this.segs.push(seg);
    }
  }

  buildUnitBar() {
    this.el.bottomBar.innerHTML = '';
    for (const typeId of DEFENDER_ORDER) {
      const d = DEFENDER_TYPES[typeId];
      const card = document.createElement('div');
      card.className = 'unit-card';
      card.innerHTML = `
        ${ICONS[typeId]}
        <div class="unit-name">${d.name}</div>
        <div class="unit-cost">${boltSvg}${d.cost}</div>
        <div class="cooldown-overlay"></div>
      `;
      card.addEventListener('click', () => {
        if (this.selectedType === typeId) {
          this.select(null);
        } else {
          this.select(typeId);
        }
      });
      card.addEventListener('mouseenter', () => this.showUnitTooltip(d, card));
      card.addEventListener('mouseleave', () => this.hideTooltip());
      this.el.bottomBar.appendChild(card);
      this.cards[typeId] = card;
    }

    // Recycler-Werkzeug: Gebäude anklicken und abreißen (60 % zurück)
    const rec = document.createElement('div');
    rec.className = 'unit-card recycler-card';
    rec.innerHTML = `
      ${RECYCLER_ICON}
      <div class="unit-name">Recycler</div>
      <div class="unit-cost">60&nbsp;% zurück</div>
      <div class="cooldown-overlay"></div>
    `;
    rec.addEventListener('click', () => {
      this.select(this.selectedType === 'recycler' ? null : 'recycler');
    });
    rec.addEventListener('mouseenter', () => {
      this.showUnitTooltip({
        name: 'Recycler',
        description: 'Werkzeug auswählen, dann ein Gebäude anklicken: Es wird abgerissen und 60 % der investierten Energie zurückerstattet.',
        cost: 0, cooldown: 0,
      }, rec);
    });
    rec.addEventListener('mouseleave', () => this.hideTooltip());
    this.el.bottomBar.appendChild(rec);
    this.cards.recycler = rec;
  }

  select(typeId) {
    this.selectedType = typeId;
    for (const [id, card] of Object.entries(this.cards)) {
      card.classList.toggle('selected', id === typeId);
    }
    this.cb.onSelectUnit(typeId);
  }

  // Karten-Zustand: ausgegraut wenn zu teuer, Cooldown-Overlay von unten
  updateCards(energy, cooldowns) {
    for (const [id, card] of Object.entries(this.cards)) {
      const d = DEFENDER_TYPES[id];
      if (!d) continue; // Recycler-Werkzeug ist immer verfügbar
      const cdRemaining = cooldowns[id] ?? 0;
      const affordable = energy >= d.cost;
      card.classList.toggle('unaffordable', !affordable || cdRemaining > 0);
      const overlay = card.querySelector('.cooldown-overlay');
      overlay.style.height = cdRemaining > 0
        ? `${(cdRemaining / d.cooldown) * 100}%`
        : '0%';
    }
  }

  setEnergy(value, flash = false) {
    this.el.energy.textContent = value;
    if (flash) {
      this.el.energy.classList.remove('flash');
      void this.el.energy.offsetWidth; // Animation neu triggern
      this.el.energy.classList.add('flash');
    }
  }

  setIntegrity(value) {
    this.segs.forEach((seg, i) => seg.classList.toggle('lost', i >= value));
  }

  setWave(current, total, countdown = null) {
    if (countdown !== null) {
      const label = current === 0 ? 'Erste Welle' : `Welle ${current + 1}`;
      this.el.waveLabel.textContent = `${label} in ${Math.ceil(countdown)} s`;
    } else {
      this.el.waveLabel.textContent = `Welle ${current} / ${total}`;
    }
  }

  showBanner(text, sub = '', danger = false) {
    const b = this.el.banner;
    b.innerHTML = text + (sub ? `<span class="banner-sub">${sub}</span>` : '');
    b.classList.toggle('danger', danger);
    b.classList.remove('hidden');
    clearTimeout(this.bannerTimeout);
    this.bannerTimeout = setTimeout(() => b.classList.add('hidden'), 3200);
  }

  showUnitTooltip(d, card) {
    const rect = card.getBoundingClientRect();
    const tt = this.el.tooltip;
    const statLine = d.cost
      ? `<div class="tt-hint">Kosten: ${d.cost} · Abklingzeit: ${d.cooldown} s${d.hp ? ` · Hülle: ${d.hp}` : ''}</div>`
      : '';
    tt.innerHTML = `
      <div class="tt-title">${d.name}</div>
      <div>${d.description}</div>
      ${statLine}
    `;
    tt.classList.remove('hidden');
    tt.style.left = `${rect.left + rect.width / 2 - 110}px`;
    tt.style.bottom = `${window.innerHeight - rect.top + 10}px`;
    tt.style.top = 'auto';
  }

  // Tooltip für platzierte Einheit an Bildschirmposition
  showPlacedTooltip(defender, x, y) {
    const d = defender.data;
    const tt = this.el.tooltip;
    tt.innerHTML = `
      <div class="tt-title">${d.name} (Stufe ${defender.level})</div>
      <div>Hülle: ${Math.ceil(defender.hp)} / ${defender.maxHp}</div>
      <div class="tt-hint">Rechtsklick erneut: abreißen (+${defender.refundValue}) · Linksklick: Ausbau-Menü</div>
    `;
    tt.classList.remove('hidden');
    tt.style.left = `${x + 14}px`;
    tt.style.top = `${y - 10}px`;
    tt.style.bottom = 'auto';
  }

  hideTooltip() {
    this.el.tooltip.classList.add('hidden');
  }

  // ---------- Ausbau-Menü (Klick auf platziertes Gebäude) ----------

  showBuildMenu(defender, x, y, opts) {
    const d = defender.data;
    const menu = this.el.buildMenu;
    const stars = '★'.repeat(defender.level)
      + `<span class="star-empty">${'★'.repeat(3 - defender.level)}</span>`;
    const canAfford = opts.energy >= defender.upgradeCost;
    const upgradeBtn = defender.canUpgrade
      ? `<button class="menu-btn upgrade-btn ${canAfford ? '' : 'disabled'}">
           Aufrüsten ${boltSvg}${defender.upgradeCost}
         </button>`
      : `<div class="menu-maxed">Vollausbau erreicht</div>`;
    menu.innerHTML = `
      <div class="menu-title">${d.name} <span class="menu-stars">${stars}</span></div>
      <div class="menu-hp">Hülle: ${Math.ceil(defender.hp)} / ${defender.maxHp}</div>
      ${upgradeBtn}
      <button class="menu-btn sell-btn">Abreißen ${boltSvg}+${defender.refundValue}</button>
    `;
    menu.classList.remove('hidden');
    // Position: neben dem Klickpunkt, aber im Bildschirm halten
    const mw = 210, mh = 150;
    menu.style.left = `${Math.min(window.innerWidth - mw - 12, x + 16)}px`;
    menu.style.top = `${Math.min(window.innerHeight - mh - 12, Math.max(12, y - 40))}px`;

    const up = menu.querySelector('.upgrade-btn');
    if (up && canAfford) up.addEventListener('click', (ev) => { ev.stopPropagation(); opts.onUpgrade(); });
    menu.querySelector('.sell-btn').addEventListener('click', (ev) => { ev.stopPropagation(); opts.onSell(); });
  }

  hideBuildMenu() {
    this.el.buildMenu?.classList.add('hidden');
  }

  floatText(x, y, text) {
    const el = document.createElement('div');
    el.className = 'float-text';
    el.textContent = text;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1100);
  }

  showScreen(name) {
    this.el.startScreen.classList.toggle('hidden', name !== 'start');
    this.el.gameoverScreen.classList.toggle('hidden', name !== 'gameover');
    this.el.winScreen.classList.toggle('hidden', name !== 'win');
    this.el.hud.classList.toggle('hidden', name !== 'game');
  }

  setGameoverStats(wave, total) {
    this.el.gameoverStats.textContent = `Erreicht: Welle ${wave} von ${total}.`;
  }
}
