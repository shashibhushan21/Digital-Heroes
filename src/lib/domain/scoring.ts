import { SCORE_RULES } from "@/lib/constants/business-rules";

export type ScoreRecord = {
  scoreDate: string;
  stablefordScore: number;
  createdAt: string;
};

export function validateScoreValue(score: number): boolean {
  return Number.isInteger(score) && score >= SCORE_RULES.min && score <= SCORE_RULES.max;
}

export function retainLatestScores(scores: ScoreRecord[]): ScoreRecord[] {
  return [...scores]
    .sort((a, b) => {
      if (a.scoreDate === b.scoreDate) {
        return b.createdAt.localeCompare(a.createdAt);
      }
      return b.scoreDate.localeCompare(a.scoreDate);
    })
    .slice(0, SCORE_RULES.retainedCount);
}

export function canInsertScoreForDate(scores: ScoreRecord[], scoreDate: string): boolean {
  return !scores.some((score) => score.scoreDate === scoreDate);
}
