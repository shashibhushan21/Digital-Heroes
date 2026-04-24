export type DrawMode = "random" | "weighted";

export type UserEntry = {
  userId: string;
  numbers: number[];
};

export type ScoreRow = {
  user_id: string;
  stableford_score: number;
  score_date: string;
  created_at: string;
};

function uniqueSortedNumbers(values: number[]): number[] {
  return Array.from(new Set(values)).sort((a, b) => a - b);
}

export function buildUserEntriesFromScores(scoreRows: ScoreRow[]): UserEntry[] {
  const grouped = new Map<string, ScoreRow[]>();

  for (const row of scoreRows) {
    const existing = grouped.get(row.user_id) ?? [];
    existing.push(row);
    grouped.set(row.user_id, existing);
  }

  const entries: UserEntry[] = [];

  for (const [userId, userScores] of grouped) {
    const latestFive = [...userScores]
      .sort((a, b) => {
        if (a.score_date === b.score_date) return b.created_at.localeCompare(a.created_at);
        return b.score_date.localeCompare(a.score_date);
      })
      .slice(0, 5)
      .map((score) => score.stableford_score);

    if (latestFive.length < 5) continue;

    entries.push({
      userId,
      numbers: uniqueSortedNumbers(latestFive),
    });
  }

  return entries;
}

function randomIntInclusive(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomUniqueNumbers(count: number, min = 1, max = 45): number[] {
  const values = new Set<number>();
  while (values.size < count) {
    values.add(randomIntInclusive(min, max));
  }
  return Array.from(values).sort((a, b) => a - b);
}

function weightedUniqueNumbers(frequencies: Map<number, number>, count: number, min = 1, max = 45): number[] {
  const available = new Set<number>();
  for (let i = min; i <= max; i += 1) available.add(i);

  const selected: number[] = [];

  while (selected.length < count && available.size > 0) {
    const weightedPool: Array<{ value: number; weight: number }> = Array.from(available).map((value) => ({
      value,
      weight: frequencies.get(value) ?? 1,
    }));

    const totalWeight = weightedPool.reduce((sum, item) => sum + item.weight, 0);
    let threshold = Math.random() * totalWeight;

    for (const item of weightedPool) {
      threshold -= item.weight;
      if (threshold <= 0) {
        selected.push(item.value);
        available.delete(item.value);
        break;
      }
    }
  }

  if (selected.length < count) {
    for (const fallback of randomUniqueNumbers(count - selected.length, min, max)) {
      if (!selected.includes(fallback)) selected.push(fallback);
    }
  }

  return selected.sort((a, b) => a - b).slice(0, count);
}

export function generateDrawNumbers(mode: DrawMode, entries: UserEntry[]): number[] {
  if (mode === "random") {
    return randomUniqueNumbers(5, 1, 45);
  }

  const frequencies = new Map<number, number>();
  for (const entry of entries) {
    for (const value of entry.numbers) {
      frequencies.set(value, (frequencies.get(value) ?? 0) + 1);
    }
  }

  return weightedUniqueNumbers(frequencies, 5, 1, 45);
}

export function countMatches(entryNumbers: number[], drawNumbers: number[]): number {
  const drawSet = new Set(drawNumbers);
  return entryNumbers.reduce((count, value) => count + (drawSet.has(value) ? 1 : 0), 0);
}

export function computeTierCounts(matchCounts: number[]): { tier5: number; tier4: number; tier3: number } {
  return {
    tier5: matchCounts.filter((count) => count === 5).length,
    tier4: matchCounts.filter((count) => count === 4).length,
    tier3: matchCounts.filter((count) => count === 3).length,
  };
}
