// Level 3 — "Sektor Abyss": 12 Wellen mit den neuen Gegnertypen
// (Schwarmlinge, Berstbrocken, Phasenspringer, Panzerwalzen) bis zum Boss-Finale.

function entry(t, type, lane) {
  return { t, type, lane };
}

// Elite-Variante: doppelte Hülle, schneller, mit Gold-Aura markiert
function elite(t, type, lane) {
  return { t, type, lane, elite: true };
}

export const LEVEL_3 = {
  name: 'Sektor Abyss',
  flavor: 'Am Schlund der Leere',
  specialCells: [
    { lane: 1, col: 2, type: 'boost' },
    { lane: 3, col: 4, type: 'boost' },
    { lane: 2, col: 7, type: 'boost' },
    { lane: 0, col: 3, type: 'blocked' },
    { lane: 2, col: 1, type: 'blocked' },
    { lane: 4, col: 4, type: 'blocked' },
    { lane: 1, col: 6, type: 'blocked' },
  ],
  waves: [
    {
      // Welle 1 — bekannter Auftakt
      label: 'Gesteinsfeld am Sektorrand',
      entries: [
        entry(0, 'kleinasteroid', 2),
        entry(4, 'kleinasteroid', 1),
        entry(8, 'kleinasteroid', 3),
        entry(12, 'schrottbrocken', 2),
        entry(16, 'kleinasteroid', 0),
        entry(18, 'kleinasteroid', 4),
      ],
    },
    {
      // Welle 2 — erste Berstbrocken
      label: 'Instabile Brocken gesichtet!',
      danger: true,
      entries: [
        entry(0, 'berstbrocken', 2),
        entry(4, 'kleinasteroid', 0),
        entry(7, 'berstbrocken', 3),
        entry(11, 'kleinasteroid', 4),
        entry(14, 'berstbrocken', 1),
        entry(18, 'schrottbrocken', 2),
      ],
    },
    {
      // Welle 3 — Schwarm-Premiere
      label: 'SCHWARM-ALARM!',
      danger: true,
      entries: [
        entry(0, 'schwarmling', 1),
        entry(0.5, 'schwarmling', 2),
        entry(1.0, 'schwarmling', 3),
        entry(3, 'schwarmling', 0),
        entry(3.5, 'schwarmling', 4),
        entry(6, 'schwarmling', 2),
        entry(6.5, 'schwarmling', 1),
        entry(7.0, 'schwarmling', 3),
        entry(11, 'schrottbrocken', 2),
        entry(15, 'schwarmling', 0),
        entry(15.5, 'schwarmling', 4),
      ],
    },
    {
      // Welle 4 — Phasenspringer tauchen auf
      label: 'Phasensignaturen flackern auf',
      danger: true,
      entries: [
        entry(0, 'phasenspringer', 2),
        entry(4, 'kleinasteroid', 1),
        entry(7, 'phasenspringer', 3),
        entry(10, 'berstbrocken', 0),
        entry(13, 'phasenspringer', 1),
        entry(16, 'schwarmling', 4),
        entry(16.5, 'schwarmling', 4),
        entry(20, 'phasenspringer', 2),
      ],
    },
    {
      // Welle 5 — erste Panzerwalze
      label: 'PANZERWALZE ORTET DIE STATION',
      danger: true,
      entries: [
        entry(0, 'panzerwalze', 2),
        entry(4, 'schwarmling', 1),
        entry(4.5, 'schwarmling', 3),
        entry(8, 'berstbrocken', 0),
        entry(11, 'kleinasteroid', 4),
        entry(14, 'phasenspringer', 1),
        entry(18, 'schrottbrocken', 3),
      ],
    },
    {
      // Welle 6 — Meteoritenschauer mit Berstbrocken
      label: 'BERSTENDER METEORITENSCHAUER!',
      danger: true,
      entries: [
        entry(0, 'kleinasteroid', 0),
        entry(0.4, 'kleinasteroid', 2),
        entry(0.8, 'kleinasteroid', 4),
        entry(1.5, 'berstbrocken', 1),
        entry(2.0, 'berstbrocken', 3),
        entry(5, 'berstbrocken', 2),
        entry(8, 'kleinasteroid', 0),
        entry(8.4, 'kleinasteroid', 4),
        entry(11, 'berstbrocken', 0),
        entry(12, 'berstbrocken', 4),
      ],
    },
    {
      // Welle 7 — Zerstörer + Springer
      label: 'Zerstörer decken die Springer',
      danger: true,
      entries: [
        entry(0, 'alienZerstoerer', 1),
        entry(3, 'phasenspringer', 3),
        entry(6, 'phasenspringer', 2),
        entry(9, 'alienZerstoerer', 3),
        entry(12, 'schwarmling', 0),
        entry(12.5, 'schwarmling', 0),
        entry(13, 'schwarmling', 4),
        entry(13.5, 'schwarmling', 4),
        entry(17, 'alienDrohne', 2),
        entry(20, 'phasenspringer', 1),
      ],
    },
    {
      // Welle 8 — Doppel-Panzerwalze
      label: 'Zwei Panzerwalzen rollen an',
      danger: true,
      entries: [
        entry(0, 'panzerwalze', 1),
        entry(3, 'panzerwalze', 3),
        entry(7, 'schwarmling', 2),
        entry(7.5, 'schwarmling', 2),
        entry(11, 'berstbrocken', 0),
        entry(14, 'berstbrocken', 4),
        entry(17, 'alienDrohne', 2),
        entry(20, 'phasenspringer', 0),
        entry(23, 'phasenspringer', 4),
      ],
    },
    {
      // Welle 9 — Großer Schwarm
      label: 'DER GROSSE SCHWARM',
      danger: true,
      entries: [
        entry(0, 'schwarmling', 0), entry(0.4, 'schwarmling', 1),
        entry(0.8, 'schwarmling', 2), entry(1.2, 'schwarmling', 3),
        entry(1.6, 'schwarmling', 4),
        entry(4, 'schwarmling', 1), entry(4.4, 'schwarmling', 3),
        entry(7, 'alienDrohne', 2),
        entry(9, 'schwarmling', 0), entry(9.4, 'schwarmling', 2),
        entry(9.8, 'schwarmling', 4),
        entry(13, 'phasenspringer', 1),
        entry(15, 'phasenspringer', 3),
        entry(18, 'schwarmling', 2), entry(18.4, 'schwarmling', 2),
      ],
    },
    {
      // Welle 10 — gepanzerte Front
      label: 'Gepanzerte Front mit Deckungsfeuer',
      danger: true,
      entries: [
        entry(0, 'panzerwalze', 2),
        entry(3, 'alienZerstoerer', 0),
        entry(6, 'alienZerstoerer', 4),
        entry(10, 'berstbrocken', 1),
        entry(12, 'berstbrocken', 3),
        entry(15, 'panzerwalze', 0),
        entry(18, 'schwarmling', 2), entry(18.5, 'schwarmling', 2),
        elite(21, 'phasenspringer', 4),
        entry(24, 'alienDrohne', 1),
      ],
    },
    {
      // Welle 11 — alles auf einmal
      label: 'CHAOS IM ABYSS',
      danger: true,
      entries: [
        entry(0, 'phantom', 0),
        entry(1, 'phantom', 4),
        entry(3, 'aegisTraeger', 2),
        elite(4, 'panzerwalze', 2),
        entry(7, 'sprengdrohne', 1), entry(7.4, 'sprengdrohne', 3),
        entry(9, 'schwarmling', 1), entry(9.4, 'schwarmling', 3),
        entry(11, 'berstbrocken', 0), entry(12, 'berstbrocken', 4),
        elite(15, 'alienZerstoerer', 1),
        entry(17, 'phantom', 3),
        entry(21, 'phasenspringer', 2),
        entry(24, 'sprengdrohne', 0), entry(24.4, 'sprengdrohne', 4),
      ],
    },
    {
      // Welle 12 — Boss mit gepanzerter Eskorte
      label: 'MUTTERSCHIFF-FRAGMENT MIT PANZER-ESKORTE',
      danger: true,
      entries: [
        entry(0, 'schwarmling', 1), entry(0.5, 'schwarmling', 3),
        entry(3, 'aegisTraeger', 2),
        entry(6, 'mutterschiffFragment', 2),
        entry(9, 'panzerwalze', 1),
        entry(12, 'panzerwalze', 3),
        entry(15, 'sprengdrohne', 2), entry(15.4, 'sprengdrohne', 2),
        elite(18, 'phantom', 0),
        elite(20, 'phantom', 4),
        entry(24, 'alienZerstoerer', 2),
        entry(28, 'berstbrocken', 0), entry(29, 'berstbrocken', 4),
        entry(32, 'schwarmling', 2), entry(32.5, 'schwarmling', 2),
      ],
    },
  ],
};
