import { describe, expect, it } from "vitest";
import { isAdmin, isSubscriber, ROLES } from "./roles";

describe("role helpers", () => {
  it("identifies admin role", () => {
    expect(isAdmin(ROLES.admin)).toBe(true);
    expect(isAdmin(ROLES.subscriber)).toBe(false);
  });

  it("identifies subscriber role", () => {
    expect(isSubscriber(ROLES.subscriber)).toBe(true);
    expect(isSubscriber(ROLES.admin)).toBe(false);
  });
});
