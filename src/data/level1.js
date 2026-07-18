// Level 1 — "Sektor Nereon": 10 Wellen inkl. Boss.
// Jede Welle ist eine Liste von { t: Sekunden nach Wellenstart, type, lane }.
// Balancing/Leveldesign passiert komplett hier, ohne Code-Logik zu ändern.

function entry(t, type, lane) {
  return { t, type, lane };
}

export const LEVEL_1 = {
  name: 'Sektor Nereon',
  flavor: 'Der ruhige Rand des Systems',
  // Level 1 bewusst ohne Spezialfelder — ruhiger Einstieg
  waves: [
    {
      // Welle 1 — erste treibende Asteroiden
      label: 'Vereinzelte Asteroiden gesichtet',
      entries: [
        entry(0, 'kleinasteroid', 2),
        entry(6, 'kleinasteroid', 1),
        entry(12, 'kleinasteroid', 3),
        entry(18, 'kleinasteroid', 2),
      ],
    },
    {
      // Welle 2 — mehr Gestein
      label: 'Asteroidenfeld voraus',
      entries: [
        entry(0, 'kleinasteroid', 0),
        entry(3, 'kleinasteroid', 4),
        entry(7, 'kleinasteroid', 2),
        entry(11, 'kleinasteroid', 1),
        entry(15, 'kleinasteroid', 3),
        entry(19, 'kleinasteroid', 0),
      ],
    },
    {
      // Welle 3 — erster Schrott
      label: 'Treibender Schrott im Anflug',
      entries: [
        entry(0, 'kleinasteroid', 1),
        entry(3, 'schrottbrocken', 2),
        entry(7, 'kleinasteroid', 4),
        entry(10, 'kleinasteroid', 0),
        entry(14, 'schrottbrocken', 3),
        entry(18, 'kleinasteroid', 2),
        entry(22, 'kleinasteroid', 1),
      ],
    },
    {
      // Welle 4 — dichter Mix
      label: 'Trümmerfeld wird dichter',
      entries: [
        entry(0, 'schrottbrocken', 0),
        entry(2, 'kleinasteroid', 2),
        entry(5, 'kleinasteroid', 3),
        entry(9, 'schrottbrocken', 4),
        entry(12, 'kleinasteroid', 1),
        entry(15, 'kleinasteroid', 0),
        entry(18, 'schrottbrocken', 2),
        entry(22, 'kleinasteroid', 4),
        entry(25, 'kleinasteroid', 3),
      ],
    },
    {
      // Welle 5 — Sonderwelle: Meteoritenschauer über alle Lanes
      label: 'METEORITENSCHAUER!',
      danger: true,
      entries: [
        entry(0, 'kleinasteroid', 0),
        entry(0.4, 'kleinasteroid', 2),
        entry(0.8, 'kleinasteroid', 4),
        entry(1.2, 'kleinasteroid', 1),
        entry(1.6, 'kleinasteroid', 3),
        entry(2.2, 'kleinasteroid', 0),
        entry(2.6, 'kleinasteroid', 4),
        entry(3.0, 'schrottbrocken', 2),
        entry(8, 'kleinasteroid', 1),
        entry(8.5, 'kleinasteroid', 3),
      ],
    },
    {
      // Welle 6 — erste Alien-Drohnen
      label: 'Alien-Signaturen erfasst',
      danger: true,
      entries: [
        entry(0, 'alienDrohne', 2),
        entry(4, 'schrottbrocken', 1),
        entry(7, 'alienDrohne', 3),
        entry(11, 'schrottbrocken', 0),
        entry(14, 'alienDrohne', 4),
        entry(18, 'schrottbrocken', 2),
        entry(22, 'schrottbrocken', 3),
      ],
    },
    {
      // Welle 7 — Drohnenschwarm
      label: 'Drohnenschwarm im Anflug',
      danger: true,
      entries: [
        entry(0, 'alienDrohne', 1),
        entry(2, 'alienDrohne', 3),
        entry(5, 'kleinasteroid', 0),
        entry(8, 'alienDrohne', 2),
        entry(10, 'alienDrohne', 4),
        entry(13, 'schrottbrocken', 1),
        entry(16, 'alienDrohne', 0),
        entry(19, 'schrottbrocken', 3),
        entry(22, 'alienDrohne', 2),
        entry(25, 'kleinasteroid', 4),
        entry(27, 'alienDrohne', 1),
      ],
    },
    {
      // Welle 8 — erste Zerstörer, die zurückschießen
      label: 'Zerstörer eröffnen das Feuer!',
      danger: true,
      entries: [
        entry(0, 'alienZerstoerer', 2),
        entry(4, 'alienDrohne', 1),
        entry(7, 'alienDrohne', 3),
        entry(10, 'schrottbrocken', 0),
        entry(13, 'alienZerstoerer', 4),
        entry(16, 'alienDrohne', 2),
        entry(19, 'schrottbrocken', 1),
        entry(23, 'alienDrohne', 0),
        entry(26, 'schrottbrocken', 3),
      ],
    },
    {
      // Welle 9 — zweiter Meteoritenschauer, gemischt
      label: 'METEORITENSCHAUER — ALLE KORRIDORE!',
      danger: true,
      entries: [
        entry(0, 'kleinasteroid', 0),
        entry(0.4, 'kleinasteroid', 1),
        entry(0.8, 'kleinasteroid', 2),
        entry(1.2, 'kleinasteroid', 3),
        entry(1.6, 'kleinasteroid', 4),
        entry(4, 'alienDrohne', 1),
        entry(5, 'alienDrohne', 3),
        entry(8, 'schrottbrocken', 0),
        entry(8.6, 'schrottbrocken', 2),
        entry(9.2, 'schrottbrocken', 4),
        entry(14, 'alienZerstoerer', 2),
        entry(18, 'alienDrohne', 0),
        entry(19, 'alienDrohne', 4),
      ],
    },
    {
      // Welle 10 — Boss mit Eskorte
      label: 'MUTTERSCHIFF-FRAGMENT ORTET DIE STATION',
      danger: true,
      entries: [
        entry(0, 'alienDrohne', 1),
        entry(2, 'alienDrohne', 3),
        entry(6, 'mutterschiffFragment', 2),
        entry(10, 'alienZerstoerer', 0),
        entry(14, 'alienZerstoerer', 4),
        entry(20, 'schrottbrocken', 1),
        entry(24, 'alienDrohne', 3),
        entry(28, 'alienDrohne', 0),
      ],
    },
  ],
};
