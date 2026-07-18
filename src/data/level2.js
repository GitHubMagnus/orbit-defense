// Level 2 — "Sektor Vortex": 12 deutlich härtere Wellen inkl. Doppel-Boss-Finale.
// Ausgelegt auf ausgebaute Türme, Ionenpuls/Raketenwerfer und aktives Nachbauen.

function entry(t, type, lane) {
  return { t, type, lane };
}

export const LEVEL_2 = {
  name: 'Sektor Vortex',
  flavor: 'Wo der Sturm die Sterne frisst',
  specialCells: [
    { lane: 2, col: 2, type: 'boost' },
    { lane: 0, col: 5, type: 'boost' },
    { lane: 4, col: 5, type: 'boost' },
    { lane: 1, col: 4, type: 'blocked' },
    { lane: 3, col: 1, type: 'blocked' },
    { lane: 2, col: 6, type: 'blocked' },
  ],
  waves: [
    {
      // Welle 1 — flotter Einstieg
      label: 'Dichtes Asteroidenfeld voraus',
      entries: [
        entry(0, 'kleinasteroid', 1),
        entry(3, 'kleinasteroid', 3),
        entry(6, 'kleinasteroid', 2),
        entry(9, 'kleinasteroid', 0),
        entry(12, 'kleinasteroid', 4),
        entry(15, 'kleinasteroid', 2),
      ],
    },
    {
      // Welle 2 — Schrott mischt früh mit
      label: 'Schrottlawine im Anflug',
      entries: [
        entry(0, 'schrottbrocken', 2),
        entry(3, 'kleinasteroid', 0),
        entry(5, 'kleinasteroid', 4),
        entry(8, 'schrottbrocken', 1),
        entry(11, 'kleinasteroid', 3),
        entry(14, 'schrottbrocken', 3),
        entry(17, 'kleinasteroid', 2),
        entry(20, 'schrottbrocken', 0),
      ],
    },
    {
      // Welle 3 — Drohnen kommen früher als in Sektor Nereon
      label: 'Alien-Vorhut gesichtet',
      danger: true,
      entries: [
        entry(0, 'alienDrohne', 2),
        entry(3, 'alienDrohne', 1),
        entry(6, 'schrottbrocken', 3),
        entry(9, 'alienDrohne', 4),
        entry(12, 'kleinasteroid', 0),
        entry(15, 'alienDrohne', 3),
        entry(18, 'schrottbrocken', 2),
      ],
    },
    {
      // Welle 4 — erster Zerstörer-Trupp
      label: 'Zerstörer-Patrouille eröffnet das Feuer',
      danger: true,
      entries: [
        entry(0, 'alienZerstoerer', 1),
        entry(4, 'alienDrohne', 3),
        entry(7, 'schrottbrocken', 0),
        entry(10, 'alienZerstoerer', 3),
        entry(13, 'alienDrohne', 2),
        entry(16, 'kleinasteroid', 4),
        entry(19, 'schrottbrocken', 2),
        entry(23, 'alienDrohne', 0),
      ],
    },
    {
      // Welle 5 — Meteoritenschauer, dichter als in Level 1
      label: 'METEORITENSCHAUER!',
      danger: true,
      entries: [
        entry(0, 'kleinasteroid', 0),
        entry(0.3, 'kleinasteroid', 1),
        entry(0.6, 'kleinasteroid', 2),
        entry(0.9, 'kleinasteroid', 3),
        entry(1.2, 'kleinasteroid', 4),
        entry(2.0, 'schrottbrocken', 1),
        entry(2.4, 'schrottbrocken', 3),
        entry(3.2, 'kleinasteroid', 0),
        entry(3.6, 'kleinasteroid', 4),
        entry(4.0, 'kleinasteroid', 2),
        entry(9, 'schrottbrocken', 2),
        entry(10, 'kleinasteroid', 1),
        entry(11, 'kleinasteroid', 3),
      ],
    },
    {
      // Welle 6 — erste Sprengdrohnen zwischen Drohnen
      label: 'SPRENGDROHNEN GEORTET!',
      danger: true,
      entries: [
        entry(0, 'schrottbrocken', 1),
        entry(1, 'schrottbrocken', 3),
        entry(4, 'sprengdrohne', 2),
        entry(6, 'alienDrohne', 0),
        entry(8, 'alienDrohne', 4),
        entry(10, 'sprengdrohne', 1),
        entry(11, 'sprengdrohne', 3),
        entry(14, 'alienDrohne', 2),
        entry(17, 'schrottbrocken', 2),
        entry(20, 'sprengdrohne', 0),
        entry(22, 'alienDrohne', 4),
      ],
    },
    {
      // Welle 7 — Zerstörer-Front
      label: 'Zerstörer-Front rückt vor',
      danger: true,
      entries: [
        entry(0, 'alienZerstoerer', 0),
        entry(3, 'alienZerstoerer', 2),
        entry(6, 'alienZerstoerer', 4),
        entry(10, 'alienDrohne', 1),
        entry(12, 'alienDrohne', 3),
        entry(15, 'schrottbrocken', 2),
        entry(18, 'alienDrohne', 0),
        entry(21, 'schrottbrocken', 4),
        entry(24, 'alienDrohne', 2),
      ],
    },
    {
      // Welle 8 — erste Phantome tauchen auf
      label: 'Phasenschemen flackern durch die Reihen',
      danger: true,
      entries: [
        entry(0, 'kleinasteroid', 0),
        entry(0.4, 'kleinasteroid', 2),
        entry(0.8, 'kleinasteroid', 4),
        entry(3, 'phantom', 1),
        entry(4, 'phantom', 3),
        entry(7, 'schrottbrocken', 0),
        entry(7.6, 'schrottbrocken', 2),
        entry(8.2, 'schrottbrocken', 4),
        entry(12, 'alienZerstoerer', 1),
        entry(15, 'phantom', 2),
        entry(19, 'alienDrohne', 0),
        entry(20, 'alienDrohne', 2),
        entry(21, 'alienDrohne', 4),
      ],
    },
    {
      // Welle 9 — Aegis-Träger schützt die Eskorte
      label: 'AEGIS-TRÄGER schirmt die Front ab',
      danger: true,
      entries: [
        entry(0, 'aegisTraeger', 2),
        entry(3, 'alienZerstoerer', 1),
        entry(4, 'alienZerstoerer', 3),
        entry(8, 'alienDrohne', 0),
        entry(11, 'alienDrohne', 4),
        entry(14, 'sprengdrohne', 2),
        entry(16, 'alienDrohne', 1),
        entry(18, 'alienDrohne', 3),
        entry(22, 'aegisTraeger', 2),
        entry(26, 'schrottbrocken', 0),
        entry(27, 'schrottbrocken', 4),
      ],
    },
    {
      // Welle 10 — erstes Mutterschiff-Fragment als Vorbote
      label: 'MUTTERSCHIFF-FRAGMENT VORAUS',
      danger: true,
      entries: [
        entry(0, 'alienDrohne', 1),
        entry(2, 'alienDrohne', 3),
        entry(5, 'mutterschiffFragment', 2),
        entry(9, 'alienZerstoerer', 0),
        entry(13, 'alienZerstoerer', 4),
        entry(18, 'schrottbrocken', 1),
        entry(21, 'alienDrohne', 3),
        entry(25, 'alienDrohne', 0),
      ],
    },
    {
      // Welle 11 — Schwarm vor dem Finale
      label: 'Letzte Schwarmwelle vor dem Sturm',
      danger: true,
      entries: [
        entry(0, 'alienDrohne', 0),
        entry(0.5, 'alienDrohne', 2),
        entry(1.0, 'alienDrohne', 4),
        entry(4, 'schrottbrocken', 1),
        entry(4.6, 'schrottbrocken', 3),
        entry(8, 'alienDrohne', 1),
        entry(8.5, 'alienDrohne', 3),
        entry(12, 'alienZerstoerer', 2),
        entry(15, 'kleinasteroid', 0),
        entry(15.4, 'kleinasteroid', 4),
        entry(18, 'alienDrohne', 2),
        entry(21, 'schrottbrocken', 0),
        entry(22, 'schrottbrocken', 4),
        entry(25, 'alienDrohne', 1),
        entry(26, 'alienDrohne', 3),
      ],
    },
    {
      // Welle 12 — DOPPEL-BOSS-FINALE
      label: 'ZWEI MUTTERSCHIFF-FRAGMENTE ORTEN DIE STATION',
      danger: true,
      entries: [
        entry(0, 'alienDrohne', 0),
        entry(2, 'alienDrohne', 4),
        entry(6, 'mutterschiffFragment', 1),
        entry(10, 'mutterschiffFragment', 3),
        entry(14, 'alienZerstoerer', 2),
        entry(18, 'alienZerstoerer', 0),
        entry(22, 'schrottbrocken', 4),
        entry(26, 'alienDrohne', 2),
        entry(30, 'alienDrohne', 0),
        entry(32, 'alienDrohne', 4),
      ],
    },
  ],
};
