// Freischalt-System: Levelsiege schalten neue Level, Gebäude und passive
// Skills frei. Der Fortschritt wird in localStorage gespeichert.

const STORAGE_KEY = 'orbitwache-progress';

// Gebäude, die von Anfang an verfügbar sind
export const STARTER_TOWERS = [
  'solarkollektor', 'laserturm', 'schildgenerator', 'traktorstrahl', 'plasmakanone',
];

// Passive Skills (wirken automatisch, sobald freigeschaltet)
export const SKILLS = {
  notreserve: {
    id: 'notreserve',
    name: 'Not-Reserve',
    description: '+50 Energie zu Beginn jedes Levels',
    icon: '🔋',
  },
  schnellkuehlung: {
    id: 'schnellkuehlung',
    name: 'Schnell-Kühlung',
    description: 'Abklingzeiten aller Gebäude −25 %',
    icon: '❄️',
  },
  ladekerne: {
    id: 'ladekerne',
    name: 'Ladekerne',
    description: 'Eingesammelte Energie-Blitze geben +10 Energie extra',
    icon: '⚡',
  },
};

// Belohnungen pro gewonnenem Level (Index = Level-Index)
export const LEVEL_REWARDS = [
  { towers: ['ionenpuls'], skills: ['notreserve'] },        // Sieg in Level 1
  { towers: ['raketenwerfer'], skills: ['schnellkuehlung'] }, // Sieg in Level 2
  { towers: ['reparaturdrohne'], skills: ['ladekerne'] },   // Sieg in Level 3
];

function defaultProgress() {
  return {
    levelsUnlocked: 1,
    towers: [...STARTER_TOWERS],
    skills: [],
    stars: {},        // Level-Index -> 1..3 Sterne (bester Lauf)
    endlessBest: 0,   // höchste erreichte Ansturm-Welle
  };
}

export function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultProgress();
    const p = JSON.parse(raw);
    return {
      levelsUnlocked: Math.max(1, p.levelsUnlocked ?? 1),
      towers: Array.isArray(p.towers) && p.towers.length ? p.towers : [...STARTER_TOWERS],
      skills: Array.isArray(p.skills) ? p.skills : [],
      stars: p.stars && typeof p.stars === 'object' ? p.stars : {},
      endlessBest: p.endlessBest ?? 0,
    };
  } catch {
    return defaultProgress();
  }
}

// Sterne-Bewertung nach Rest-Integrität (bester Lauf wird gespeichert)
export function starsForIntegrity(integrity) {
  return integrity >= 8 ? 3 : integrity >= 4 ? 2 : 1;
}

export function recordStars(progress, levelIndex, stars) {
  const prev = progress.stars[levelIndex] ?? 0;
  if (stars > prev) {
    progress.stars[levelIndex] = stars;
    saveProgress(progress);
    return true;
  }
  return false;
}

export function recordEndlessBest(progress, wave) {
  if (wave > progress.endlessBest) {
    progress.endlessBest = wave;
    saveProgress(progress);
    return true;
  }
  return false;
}

export function saveProgress(progress) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // localStorage nicht verfügbar (z. B. private mode) — Fortschritt gilt nur für die Sitzung
  }
}

// Setzt den Fortschritt auf Werkseinstellung zurück (löscht den Spielstand).
export function resetProgress() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignorieren
  }
  return defaultProgress();
}

// Wendet die Belohnungen eines Levelsiegs an; liefert die NEUEN Freischaltungen
// als { levels: [...], towers: [...], skills: [...] } für die Sieg-Anzeige.
export function unlockAfterWin(progress, levelIndex, totalLevels) {
  const gained = { levels: [], towers: [], skills: [] };

  const nextLevel = levelIndex + 2; // 1-basiert: nach Level 1 wird Level 2 frei
  if (nextLevel <= totalLevels && progress.levelsUnlocked < nextLevel) {
    progress.levelsUnlocked = nextLevel;
    gained.levels.push(nextLevel);
  }

  const reward = LEVEL_REWARDS[levelIndex];
  if (reward) {
    for (const t of reward.towers ?? []) {
      if (!progress.towers.includes(t)) {
        progress.towers.push(t);
        gained.towers.push(t);
      }
    }
    for (const s of reward.skills ?? []) {
      if (!progress.skills.includes(s)) {
        progress.skills.push(s);
        gained.skills.push(s);
      }
    }
  }

  saveProgress(progress);
  return gained;
}

// Für das Lexikon/gesperrte Karten: durch welchen Levelsieg wird ein Turm frei?
export function unlockSourceForTower(towerId) {
  const i = LEVEL_REWARDS.findIndex((r) => r.towers?.includes(towerId));
  return i >= 0 ? i + 1 : null; // 1-basierter Level-Index
}
