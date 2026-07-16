// Gegner-Roster — reine Datenobjekte.

export const ENEMY_TYPES = {
  kleinasteroid: {
    id: 'kleinasteroid',
    name: 'Kleinasteroid',
    hp: 60,
    speed: 2.0,
    meleeDps: 20,
    integrityDamage: 1,
    kind: 'rock',       // rock | alien — steuert Farben & Todes-Effekt
    scale: 1.0,
  },
  schrottbrocken: {
    id: 'schrottbrocken',
    name: 'Schrottbrocken',
    hp: 160,
    speed: 1.3,
    meleeDps: 25,
    integrityDamage: 1,
    kind: 'rock',
    scale: 1.15,
  },
  alienDrohne: {
    id: 'alienDrohne',
    name: 'Alien-Drohne',
    hp: 95,
    speed: 2.6,
    meleeDps: 18,
    integrityDamage: 1,
    kind: 'alien',
    scale: 1.0,
    waveMotion: { amplitude: 1.1, frequency: 2.2 }, // wellenförmiger Flug
  },
  alienZerstoerer: {
    id: 'alienZerstoerer',
    name: 'Alien-Zerstörer',
    hp: 280,
    speed: 1.0,
    meleeDps: 30,
    integrityDamage: 2,
    kind: 'alien',
    scale: 1.25,
    rangedAttack: { damage: 16, interval: 2.2, range: 9 }, // schießt auf Türme
  },
  mutterschiffFragment: {
    id: 'mutterschiffFragment',
    name: 'Mutterschiff-Fragment',
    hp: 2200,
    speed: 0.45,
    meleeDps: 70,
    integrityDamage: 5,
    kind: 'alien',
    scale: 1.0, // Mesh selbst ist bereits groß gebaut
    hpBarHeight: 5.9,
    isBoss: true,
    spawnMinions: { type: 'alienDrohne', interval: 13 },
  },
};
