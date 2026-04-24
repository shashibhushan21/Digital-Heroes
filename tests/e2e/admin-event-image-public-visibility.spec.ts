import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const adminEmail = process.env.ADMIN_EMAIL;
const adminPassword = process.env.ADMIN_PASSWORD;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let setupReady = false;
let setupReason = "";

async function ensureAdminPasswordAuthReady() {
  if (!adminEmail || !adminPassword) {
    setupReason = "ADMIN_EMAIL and ADMIN_PASSWORD must be set for this test.";
    return;
  }

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    setupReason = "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for deterministic auth setup.";
    return;
  }

  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let userId: string | null = null;

  const { data: existingUsers } = await adminClient.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  const existingUser = existingUsers?.users.find((user: User) => user.email?.toLowerCase() === adminEmail.toLowerCase());
  if (existingUser) {
    userId = existingUser.id;
    // Update existing user
    const { error: updateError } = await adminClient.auth.admin.updateUserById(userId, {
      password: adminPassword,
      app_metadata: { role: "admin" },
      user_metadata: { role: "admin" },
    });
    if (updateError) {
      setupReason = `Unable to update existing admin auth user: ${updateError.message}`;
      return;
    }
  } else {
    // Create new user
    const { data: createdUserData, error: createError } = await adminClient.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
      app_metadata: { role: "admin" },
      user_metadata: { role: "admin" },
    });

    if (createError) {
      setupReason = `Unable to seed admin auth user: ${createError.message}`;
      return;
    }

    userId = createdUserData.user?.id;
    if (!userId) {
      setupReason = "Unable to get created admin user ID.";
      return;
    }
  }

  const { error: upsertUserError } = await adminClient.from("users").upsert(
    {
      id: userId,
      email: adminEmail.toLowerCase(),
      role: "admin",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );

  if (upsertUserError) {
    setupReason = `Unable to upsert admin role row: ${upsertUserError.message}`;
    return;
  }

  setupReady = true;
}

test.describe("Admin event image upload and public event visibility", () => {
  test.setTimeout(120_000);

  test.beforeAll(async () => {
    await ensureAdminPasswordAuthReady();
  });

  test("uploaded event image appears on public charity event card", async ({ page }) => {
    test.skip(!setupReady, setupReason || "Admin auth setup not ready.");

    const marker = `e2e-event-${Date.now()}`;
    const eventTitle = `Charity Event ${marker}`;
    const imageDataUrl = `data:image/svg+xml;base64,${Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><rect width="1" height="1" fill="white"/><text x="0" y="1">${marker}</text></svg>`,
    ).toString("base64")}`;

    await page.goto("/auth/login");
    await page.getByLabel("Email").fill(adminEmail!);
    await page.getByLabel("Password", { exact: true }).fill(adminPassword!);
    await Promise.all([
      page.waitForURL(/\/dashboard/, { timeout: 30_000, waitUntil: "commit" }),
      page.getByRole("button", { name: "Sign in with password" }).click(),
    ]);

    await page.goto("/admin");
    await page.getByRole("tab", { name: "Charities" }).click();

    const charityCard = page.locator("article", { hasText: "Fairways for Future" }).first();
    await expect(charityCard).toBeVisible();
    await charityCard.getByRole("button", { name: "Manage Content" }).click();

    const charityPanel = page.locator("article", { hasText: "Fairways for Future" }).first();
    const forms = charityPanel.locator("form");
    const eventForm = forms.nth(1);

    await eventForm.getByPlaceholder("Event title").fill(eventTitle);
    await eventForm.getByPlaceholder("Event description").fill(`Public visibility check ${marker}`);

    const now = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const startsAt = now.toISOString().slice(0, 16);
    await eventForm.locator('input[type="datetime-local"]').first().fill(startsAt);

    await eventForm.getByPlaceholder("Event image URL").fill(imageDataUrl);

    await eventForm.getByRole("button", { name: "Add Event" }).click();

    await expect(charityPanel.locator("p", { hasText: eventTitle }).first()).toBeVisible({ timeout: 15000 });

    await page.goto("/charities/fairways-for-future");
    await expect(page.getByRole("heading", { name: "Fairways for Future" })).toBeVisible({ timeout: 30000 });
    await expect(page.getByRole("heading", { name: eventTitle })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole("img", { name: `Event image for ${eventTitle}` })).toBeVisible({ timeout: 15000 });
  });
});
