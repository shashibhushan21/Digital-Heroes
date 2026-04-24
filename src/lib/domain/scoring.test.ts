import { describe, expect, it } from "vitest";
import { canInsertScoreForDate, retainLatestScores, validateScoreValue } from "./scoring";

describe("scoring rules", () => {
  it("validates score range", () => {
    expect(validateScoreValue(1)).toBe(true);
    expect(validateScoreValue(45)).toBe(true);
    expect(validateScoreValue(0)).toBe(false);
    expect(validateScoreValue(46)).toBe(false);
  });

  it("prevents duplicate date insert", () => {
    const scores = [
      { scoreDate: "2026-04-20", stablefordScore: 32, createdAt: "2026-04-20T10:00:00Z" },
    ];

    expect(canInsertScoreForDate(scores, "2026-04-20")).toBe(false);
    expect(canInsertScoreForDate(scores, "2026-04-21")).toBe(true);
  });

  it("retains latest five scores by date descending", () => {
    const scores = [
      { scoreDate: "2026-04-01", stablefordScore: 20, createdAt: "2026-04-01T00:00:00Z" },
      { scoreDate: "2026-04-02", stablefordScore: 21, createdAt: "2026-04-02T00:00:00Z" },
      { scoreDate: "2026-04-03", stablefordScore: 22, createdAt: "2026-04-03T00:00:00Z" },
      { scoreDate: "2026-04-04", stablefordScore: 23, createdAt: "2026-04-04T00:00:00Z" },
      { scoreDate: "2026-04-05", stablefordScore: 24, createdAt: "2026-04-05T00:00:00Z" },
      { scoreDate: "2026-04-06", stablefordScore: 25, createdAt: "2026-04-06T00:00:00Z" },
    ];

    const retained = retainLatestScores(scores);

    expect(retained).toHaveLength(5);
    expect(retained[0].scoreDate).toBe("2026-04-06");
    expect(retained[4].scoreDate).toBe("2026-04-02");
  });
});
