// Endlos-Modus "Ansturm": prozedural erzeugte, unendlich skalierende Wellen.
// Jede 5. Welle bringt einen Boss, ab Welle 8 tauchen Elite-Gegner auf.

const POOL = [
  { type: 'kleinasteroid', cost: 1, min: 1 },
  { type: 'schwarmling', cost: 1, min: 2 },
  { type: 'schrottbrocken', cost: 2, min: 2 },
  { type: 'alienDrohne', cost: 2, min: 3 },
  { type: 'berstbrocken', cost: 2.5, min: 4 },
  { type: 'phasenspringer', cost: 3, min: 5 },
  { type: 'alienZerstoerer', cost: 4, min: 6 },
  { type: 'panzerwalze', cost: 6, min: 7 },
];

export const ENDLESS_LEVEL = { name: 'Ansturm', endless: true };

// n ist 1-basiert (Welle 1, 2, 3, ...)
export function makeEndlessWave(n) {
  const entries = [];
  let budget = 6 + n * 2.5 + n * n * 0.08;

  const isBossWave = n % 5 === 0;
  if (isBossWave) {
    entries.push({ t: 2, type: 'mutterschiffFragment', lane: 1 + Math.floor(Math.random() * 3) });
    budget = Math.max(4, budget - 20);
  }

  const avail = POOL.filter((p) => p.min <= n);
  let t = 0;
  let guard = 0;
  while (budget >= 1 && guard++ < 200) {
    const p = avail[Math.floor(Math.random() * avail.length)];
    if (p.cost > budget) continue;
    budget -= p.cost;
    const elite = n >= 8 && Math.random() < Math.min(0.35, 0.03 + n * 0.012);
    if (elite) budget -= p.cost; // Eliten kosten doppelt
    entries.push({ t, type: p.type, lane: Math.floor(Math.random() * 5), elite });
    t += Math.max(0.5, 3.4 - n * 0.07) * (0.6 + Math.random() * 0.8);
  }
  entries.sort((a, b) => a.t - b.t);

  return {
    label: isBossWave ? `ANSTURM-WELLE ${n} — BOSS!` : `Ansturm-Welle ${n}`,
    danger: isBossWave || n >= 10,
    entries,
  };
}
