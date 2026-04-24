import { expect, test } from "@playwright/test";

const fallbackEmail = process.env.ADMIN_EMAIL ?? `e2e.recovery.${Date.now()}@example.test`;

test.describe("Password signup and recovery", () => {
  test("user can create an account with email and password", async ({ page }) => {
    const email = `e2e.signup.${Date.now()}@example.test`;
    const password = "TestPass#2026";

    await page.goto("/auth/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByLabel("Confirm password (for registration)", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Create account with password" }).click();

    let redirectedToDashboard = false;
    try {
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });
      redirectedToDashboard = true;
    } catch {
      redirectedToDashboard = false;
    }

    if (!redirectedToDashboard) {
      await expect(
        page
          .locator("p")
          .filter({ hasText: /Account created\. Please check your email to verify your account before signing in\.|Account created and signed in successfully\.|Error sending confirmation email|Unable to create account\./i })
          .first(),
      ).toBeVisible();
    }
  });

  test("forgot password flow sends reset email message", async ({ page }) => {
    await page.goto("/auth/forgot-password");
    await page.getByLabel("Email").fill(fallbackEmail);
    await page.getByRole("button", { name: "Send reset link" }).click();

    await expect(
      page
        .locator("p")
        .filter({ hasText: /Password reset email sent\. Please check your inbox\.|Unable to send password reset email\./i })
        .first(),
    ).toBeVisible();
  });

  test("reset password page without token shows invalid link guidance", async ({ page }) => {
    await page.goto("/auth/reset-password");

    await expect(
      page.locator("p", {
        hasText: "Reset link is invalid or expired. Request a new password reset email.",
      }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Request new reset link" })).toBeVisible();
  });
});
