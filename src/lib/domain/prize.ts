import { PRIZE_TIER_SHARES } from "@/lib/constants/business-rules";

export type PrizePoolInput = {
  grossPoolMinor: number;
  rolloverInMinor: number;
};

export type PrizePoolResult = {
  tier5Minor: number;
  tier4Minor: number;
  tier3Minor: number;
  rolloverInMinor: number;
  distributedMinor: number;
};

function floorMoney(value: number): number {
  return Math.floor(value);
}

export function calculatePrizePools(input: PrizePoolInput): PrizePoolResult {
  const tier5FromGross = floorMoney(input.grossPoolMinor * PRIZE_TIER_SHARES.tier5);
  const tier4Minor = floorMoney(input.grossPoolMinor * PRIZE_TIER_SHARES.tier4);
  const tier3Minor = floorMoney(input.grossPoolMinor * PRIZE_TIER_SHARES.tier3);
  const tier5Minor = tier5FromGross + input.rolloverInMinor;

  return {
    tier5Minor,
    tier4Minor,
    tier3Minor,
    rolloverInMinor: input.rolloverInMinor,
    distributedMinor: tier5Minor + tier4Minor + tier3Minor,
  };
}

export function splitTierAmount(amountMinor: number, winnerCount: number): number {
  if (winnerCount <= 0) {
    return 0;
  }
  return floorMoney(amountMinor / winnerCount);
}
