import { describe, expect, it } from "vitest";
import { isActiveSubscriptionStatus } from "./plans";

describe("subscription status helpers", () => {
  it("returns true for active statuses", () => {
    expect(isActiveSubscriptionStatus("active")).toBe(true);
    expect(isActiveSubscriptionStatus("trialing")).toBe(true);
  });

  it("returns false for non-active statuses", () => {
    expect(isActiveSubscriptionStatus("past_due")).toBe(false);
    expect(isActiveSubscriptionStatus("canceled")).toBe(false);
    expect(isActiveSubscriptionStatus(undefined)).toBe(false);
  });
});
