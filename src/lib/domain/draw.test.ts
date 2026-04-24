import { describe, expect, it } from "vitest";
import { buildUserEntriesFromScores, computeTierCounts, countMatches, generateDrawNumbers } from "./draw";

describe("draw domain", () => {
  it("builds entries from latest 5 user scores", () => {
    const entries = buildUserEntriesFromScores([
      { user_id: "u1", stableford_score: 10, score_date: "2026-04-01", created_at: "2026-04-01T00:00:00Z" },
      { user_id: "u1", stableford_score: 11, score_date: "2026-04-02", created_at: "2026-04-02T00:00:00Z" },
      { user_id: "u1", stableford_score: 12, score_date: "2026-04-03", created_at: "2026-04-03T00:00:00Z" },
      { user_id: "u1", stableford_score: 13, score_date: "2026-04-04", created_at: "2026-04-04T00:00:00Z" },
      { user_id: "u1", stableford_score: 14, score_date: "2026-04-05", created_at: "2026-04-05T00:00:00Z" },
      { user_id: "u2", stableford_score: 30, score_date: "2026-04-05", created_at: "2026-04-05T00:00:00Z" },
    ]);

    expect(entries).toHaveLength(1);
    expect(entries[0].userId).toBe("u1");
    expect(entries[0].numbers).toEqual([10, 11, 12, 13, 14]);
  });

  it("generates 5 unique numbers in range", () => {
    const numbers = generateDrawNumbers("random", []);
    expect(numbers).toHaveLength(5);
    expect(new Set(numbers).size).toBe(5);
    for (const value of numbers) {
      expect(value).toBeGreaterThanOrEqual(1);
      expect(value).toBeLessThanOrEqual(45);
    }
  });

  it("counts matches and tier totals", () => {
    expect(countMatches([1, 2, 3, 4, 5], [1, 2, 9, 10, 11])).toBe(2);
    expect(computeTierCounts([5, 4, 4, 3, 2, 3, 0])).toEqual({ tier5: 1, tier4: 2, tier3: 2 });
  });
});
