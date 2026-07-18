// Einheiten-Roster der Verteidiger — reine Datenobjekte.
// Neue Einheiten werden hier ergänzt, ohne Kernlogik anzufassen.

export const DEFENDER_TYPES = {
  solarkollektor: {
    id: 'solarkollektor',
    name: 'Solarkollektor',
    description: 'Produziert alle 9 s einen Energiekristall (25). Kein Angriff.',
    cost: 75,
    cooldown: 7,
    hp: 90,
    behavior: 'generator',
    generateInterval: 9,
    color: 0xB3E5FC,
  },
  laserturm: {
    id: 'laserturm',
    name: 'Laserturm',
    description: 'Standard-Fernkampf. Schießt Laserbolzen auf den vordersten Gegner in seiner Lane.',
    cost: 100,
    cooldown: 4,
    hp: 120,
    behavior: 'shooter',
    damage: 12,
    fireInterval: 1.0,
    range: 15,
    projectile: 'laser',
    color: 0x4DD0E1,
  },
  schildgenerator: {
    id: 'schildgenerator',
    name: 'Schildgenerator',
    description: 'Blockiert die Lane mit einem Energieschild. Hält viele Treffer aus, greift nicht an.',
    cost: 50,
    cooldown: 9,
    hp: 480,
    behavior: 'blocker',
    color: 0x80DEEA,
  },
  traktorstrahl: {
    id: 'traktorstrahl',
    name: 'Traktorstrahl-Node',
    description: 'Verlangsamt alle Gegner im Umkreis um 45 %. Kein direkter Schaden.',
    cost: 100,
    cooldown: 8,
    hp: 100,
    behavior: 'slower',
    slowFactor: 0.45,
    range: 7.5,
    color: 0xB3E5FC,
  },
  plasmakanone: {
    id: 'plasmakanone',
    name: 'Plasmakanone',
    description: 'Langsame, schwere Plasmakugeln mit hohem Einzelschaden. Stark gegen robuste Ziele.',
    cost: 175,
    cooldown: 6,
    hp: 130,
    behavior: 'shooter',
    damage: 55,
    fireInterval: 2.8,
    range: 17,
    projectile: 'plasma',
    color: 0xFFFFFF,
  },
  ionenpuls: {
    id: 'ionenpuls',
    name: 'Ionenpuls',
    description: 'Entlädt regelmäßig eine Schockwelle, die ALLE Gegner im Umkreis trifft — auch in Nachbar-Lanes.',
    cost: 150,
    cooldown: 7,
    hp: 110,
    behavior: 'pulse',
    damage: 20,
    pulseInterval: 2.4,
    range: 6.5,
    color: 0x7DF3FF,
  },
  raketenwerfer: {
    id: 'raketenwerfer',
    name: 'Raketenwerfer',
    description: 'Feuert Splitterraketen mit Flächenschaden am Einschlagsort. Ideal gegen dichte Wellen.',
    cost: 200,
    cooldown: 8,
    hp: 120,
    behavior: 'shooter',
    damage: 42,
    fireInterval: 3.2,
    range: 18,
    projectile: 'rakete',
    splash: 3.2,
    color: 0xFF8A5C,
  },
  reparaturdrohne: {
    id: 'reparaturdrohne',
    name: 'Reparatur-Drohne',
    description: 'Repariert beschädigte Gebäude im Umkreis laufend. Kein Angriff.',
    cost: 125,
    cooldown: 10,
    hp: 85,
    behavior: 'healer',
    healPerSec: 9,
    range: 5.5,
    color: 0x3ECF6A,
  },
  kryoturm: {
    id: 'kryoturm',
    name: 'Kryo-Turm',
    description: 'Feuert Frostgeschosse, die getroffene Gegner spürbar verlangsamen. Wenig Schaden, aber bremst ganze Schwärme aus.',
    cost: 120,
    cooldown: 5,
    hp: 100,
    behavior: 'shooter',
    damage: 9,
    fireInterval: 1.1,
    range: 15,
    projectile: 'frost',
    frost: { factor: 0.5, duration: 2.5 },
    color: 0x8fe6ff,
  },
  kettenblitz: {
    id: 'kettenblitz',
    name: 'Kettenblitz',
    description: 'Entlädt einen Blitz, der von Gegner zu Gegner springt (bis zu 3 Sprünge). Hervorragend gegen dichte Gruppen.',
    cost: 160,
    cooldown: 7,
    hp: 100,
    behavior: 'chain',
    damage: 24,
    chainInterval: 1.5,
    range: 14,
    chainCount: 3,
    chainRange: 4.5,
    chainFalloff: 0.65,
    color: 0xb388ff,
  },
  railkanone: {
    id: 'railkanone',
    name: 'Railkanone',
    description: 'Panzerbrechender Schienenschuss über die gesamte Lane, der ALLE Gegner in der Reihe durchschlägt und Resistenzen ignoriert. Langsam, aber verheerend.',
    cost: 220,
    cooldown: 9,
    hp: 120,
    behavior: 'beam',
    damage: 55,
    beamInterval: 3.4,
    range: 46,
    color: 0xffb066,
  },
};

// Reihenfolge in der Auswahl-Leiste
export const DEFENDER_ORDER = [
  'solarkollektor',
  'laserturm',
  'schildgenerator',
  'traktorstrahl',
  'plasmakanone',
  'ionenpuls',
  'kryoturm',
  'raketenwerfer',
  'kettenblitz',
  'reparaturdrohne',
  'railkanone',
];

// Ausbau-System: Stufe 1-3, Kosten pro Stufe = 75 % der Baukosten.
// Pro Ausbau wählt der Spieler einen von zwei Pfaden (A oder B).
export const MAX_LEVEL = 3;
export const UPGRADE_COST_FACTOR = 0.75;

// Die beiden Ausbau-Optionen je Verhalten (A = Kraft-Pfad, B = Tempo-Pfad)
export function upgradeOptionsFor(data) {
  switch (data.behavior) {
    case 'shooter':
      return [
        { key: 'a', icon: '⚔', label: 'Schaden +50 %' },
        { key: 'b', icon: '⚡', label: 'Feuerrate +33 %' },
      ];
    case 'pulse':
      return [
        { key: 'a', icon: '⚔', label: 'Schaden +50 %' },
        { key: 'b', icon: '⚡', label: 'Pulsrate +33 %' },
      ];
    case 'chain':
      return [
        { key: 'a', icon: '⚔', label: 'Schaden +50 %' },
        { key: 'b', icon: '⚡', label: 'Blitzrate +33 %' },
      ];
    case 'beam':
      return [
        { key: 'a', icon: '⚔', label: 'Schaden +50 %' },
        { key: 'b', icon: '⚡', label: 'Ladezeit −25 %' },
      ];
    case 'generator':
      return [
        { key: 'a', icon: '🛡', label: 'Hülle +80 %' },
        { key: 'b', icon: '⚡', label: 'Produktion +33 %' },
      ];
    case 'blocker':
      return [
        { key: 'a', icon: '🛡', label: 'Panzerung +80 %' },
        { key: 'b', icon: '✚', label: 'Selbstreparatur' },
      ];
    case 'slower':
      return [
        { key: 'a', icon: '🌀', label: 'Sog +12 %' },
        { key: 'b', icon: '⌖', label: 'Reichweite +25 %' },
      ];
    case 'healer':
      return [
        { key: 'a', icon: '✚', label: 'Heilrate +50 %' },
        { key: 'b', icon: '⌖', label: 'Reichweite +25 %' },
      ];
    default:
      return [
        { key: 'a', icon: '🛡', label: 'Hülle +50 %' },
        { key: 'b', icon: '🛡', label: 'Hülle +50 %' },
      ];
  }
}
