import { expect, test } from "@playwright/test";

test.describe("Public smoke", () => {
  test("home page renders key content", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "Premium golf competition." })).toBeVisible();
    await expect(page.getByRole("link", { name: "Start Subscription" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Explore Charities" })).toBeVisible();
  });

  test("charity directory route is reachable", async ({ page }) => {
    await page.goto("/charities");
    await expect(page.getByRole("heading", { name: "Charity Directory" })).toBeVisible();
  });
});
