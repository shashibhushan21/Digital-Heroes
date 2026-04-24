import { describe, expect, it } from "vitest";
import { calculatePrizePools, splitTierAmount } from "./prize";

describe("prize rules", () => {
  it("calculates tier pools with rollover", () => {
    const result = calculatePrizePools({ grossPoolMinor: 100_00, rolloverInMinor: 25_00 });

    expect(result.tier5Minor).toBe(65_00);
    expect(result.tier4Minor).toBe(35_00);
    expect(result.tier3Minor).toBe(25_00);
    expect(result.distributedMinor).toBe(125_00);
  });

  it("splits tier amount equally using integer minor units", () => {
    expect(splitTierAmount(1000, 4)).toBe(250);
    expect(splitTierAmount(1001, 4)).toBe(250);
    expect(splitTierAmount(1000, 0)).toBe(0);
  });
});
