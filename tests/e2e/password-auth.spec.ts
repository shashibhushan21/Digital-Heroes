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

test.describe("Password authentication", () => {
  test.beforeAll(async () => {
    await ensureAdminPasswordAuthReady();
  });

  test("admin can sign in with password and open admin console", async ({ page }) => {
    test.skip(!setupReady, setupReason || "Admin auth setup not ready.");

    await page.goto("/auth/login");
    await page.getByLabel("Email").fill(adminEmail!);
    await page.getByLabel("Password", { exact: true }).fill(adminPassword!);
    await Promise.all([
      page.waitForURL(/\/dashboard/, { timeout: 30_000, waitUntil: "commit" }),
      page.getByRole("button", { name: "Sign in with password" }).click(),
    ]);

    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin/);
    await expect(page.getByRole("heading", { name: "Admin Console" })).toBeVisible();
  });

  test("shows error for invalid password", async ({ page }) => {
    test.skip(!setupReady, setupReason || "Admin auth setup not ready.");

    await page.goto("/auth/login");
    await page.getByLabel("Email").fill(adminEmail!);
    await page.getByLabel("Password", { exact: true }).fill("definitely-wrong-password");
    await page.getByRole("button", { name: "Sign in with password" }).click();

    await expect(page.locator("p", { hasText: "Invalid email or password." }).first()).toBeVisible();
  });
});
