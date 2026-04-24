import { describe, expect, it } from "vitest";
import { buildNotificationTemplate } from "./templates";

describe("notification templates", () => {
  it("builds subscription activation email content", () => {
    const template = buildNotificationTemplate("subscription.activated", {
      planCode: "monthly",
      currentPeriodEnd: "2026-06-01T00:00:00.000Z",
    });

    expect(template.subject).toBe("Subscription activated");
    expect(template.text).toContain("monthly");
    expect(template.text).toContain("2026-06-01");
  });

  it("builds subscription renewal email content", () => {
    const template = buildNotificationTemplate("subscription.renewed", {
      planCode: "yearly",
      currentPeriodEnd: "2027-05-01T00:00:00.000Z",
    });

    expect(template.subject).toBe("Subscription renewed");
    expect(template.text).toContain("yearly");
    expect(template.text).toContain("2027-05-01");
  });

  it("builds subscription canceled email content", () => {
    const template = buildNotificationTemplate("subscription.canceled", {
      currentPeriodEnd: "2026-07-15T00:00:00.000Z",
    });

    expect(template.subject).toBe("Subscription canceled");
    expect(template.text).toContain("2026-07-15");
  });

  it("builds subscription lapsed email content", () => {
    const template = buildNotificationTemplate("subscription.lapsed", {});

    expect(template.subject).toBe("Subscription lapsed");
    expect(template.text).toContain("billing issue");
  });

  it("builds payout paid email content", () => {
    const template = buildNotificationTemplate("winner.payout.paid", { paymentReference: "abc-123" });

    expect(template.subject).toBe("Payout sent");
    expect(template.text).toContain("abc-123");
  });

  it("falls back to generic template for unknown events", () => {
    const template = buildNotificationTemplate("unknown.event", {});

    expect(template.subject).toBe("Digital Heros update");
  });
});
