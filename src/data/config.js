// Zentrale Spielfeld- und Balancing-Konstanten.

export const LANES = 5;          // Anzahl Andockkorridore
export const COLS = 9;           // platzierbare Felder pro Lane
export const CELL_X = 4;         // Feldbreite entlang der Lane
export const LANE_SPACING = 5.2; // Abstand der Lanes in Z

export const GRID_LEFT_X = -16;  // Zentrum der linkesten Zelle
export const SPAWN_X = 26;       // Gegner-Eintrittspunkt (rechts)
export const CORE_X = -21;       // Reaktorkern (links) — hier verliert man Integrität

export const START_ENERGY = 150;
export const START_INTEGRITY = 10;
export const SELL_REFUND = 0.6;  // Anteil der Kosten bei Verkauf

export const CRYSTAL_VALUE = 25;         // Wert eines treibenden Energiekristalls
export const CRYSTAL_SPAWN_MIN = 5.0;    // Sekunden zwischen ambienten Kristallen
export const CRYSTAL_SPAWN_MAX = 8.5;
export const CRYSTAL_LIFETIME = 14;      // Sekunden bis ein Kristall verglüht

export const FIRST_WAVE_DELAY = 18;      // Vorbereitungszeit vor Welle 1
export const BREAK_BETWEEN_WAVES = 12;   // Verschnaufpause zwischen Wellen

export function laneZ(lane) {
  return (lane - (LANES - 1) / 2) * LANE_SPACING;
}

export function colX(col) {
  return GRID_LEFT_X + col * CELL_X;
}
