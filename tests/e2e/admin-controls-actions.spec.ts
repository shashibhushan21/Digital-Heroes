import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

type AdminSeedDatabase = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          role: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          role: string;
          updated_at: string;
        };
        Update: {
          id?: string;
          email?: string;
          role?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          user_id: string;
          full_name: string | null;
          country_code: string | null;
          timezone: string | null;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          full_name?: string | null;
          country_code?: string | null;
          timezone?: string | null;
          updated_at: string;
        };
        Update: {
          user_id?: string;
          full_name?: string | null;
          country_code?: string | null;
          timezone?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      scores: {
        Row: {
          user_id: string;
          score_date: string;
          stableford_score: number;
          created_by_admin: boolean;
        };
        Insert: {
          user_id: string;
          score_date: string;
          stableford_score: number;
          created_by_admin?: boolean;
        };
        Update: {
          user_id?: string;
          score_date?: string;
          stableford_score?: number;
          created_by_admin?: boolean;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

type AdminClient = SupabaseClient<AdminSeedDatabase>;

const adminEmail = process.env.ADMIN_EMAIL;
const adminPassword = process.env.ADMIN_PASSWORD;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const targetEmail = `e2e.admin.actions.${Date.now()}@example.test`;
const targetPassword = "TestPass#2026";
const targetFullName = `E2E Action User ${Date.now()}`;
const targetCountry = "US";
const targetTimezone = "UTC";
const seededScoreDate = "2026-04-15";
const seededScoreValue = 12;
const updatedScoreValue = 13;

let setupReady = false;
let setupReason = "";

async function ensureAdminPasswordAuthReady(adminClient: AdminClient) {
  if (!adminEmail || !adminPassword) {
    setupReason = "ADMIN_EMAIL and ADMIN_PASSWORD must be set for this test.";
    return;
  }

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
}

async function seedTargetUserAndScore(adminClient: AdminClient) {
  const { data: createdAuthUser, error: createTargetError } = await adminClient.auth.admin.createUser({
    email: targetEmail,
    password: targetPassword,
    email_confirm: true,
    app_metadata: { role: "subscriber" },
    user_metadata: { role: "subscriber" },
  });

  if (createTargetError && !createTargetError.message.toLowerCase().includes("already")) {
    setupReason = `Unable to create target user: ${createTargetError.message}`;
    return;
  }

  let targetUserId = createdAuthUser.user?.id ?? null;

  if (!targetUserId) {
    const { data: listedUsers, error: listError } = await adminClient.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

    if (listError) {
      setupReason = `Unable to locate target user: ${listError.message}`;
      return;
    }

    targetUserId = listedUsers.users.find((user: User) => user.email?.toLowerCase() === targetEmail.toLowerCase())?.id ?? null;
  }

  if (!targetUserId) {
    setupReason = "Unable to resolve target user ID.";
    return;
  }

  const { error: upsertUserError } = await adminClient.from("users").upsert(
    {
      id: targetUserId,
      email: targetEmail.toLowerCase(),
      role: "subscriber",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );

  if (upsertUserError) {
    setupReason = `Unable to upsert target user row: ${upsertUserError.message}`;
    return;
  }

  const { error: upsertProfileError } = await adminClient.from("profiles").upsert(
    {
      user_id: targetUserId,
      full_name: "",
      country_code: null,
      timezone: "UTC",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (upsertProfileError) {
    setupReason = `Unable to upsert target profile: ${upsertProfileError.message}`;
    return;
  }

  await adminClient
    .from("scores")
    .delete()
    .eq("user_id", targetUserId)
    .eq("score_date", seededScoreDate);

  const { error: insertScoreError } = await adminClient.from("scores").insert({
    user_id: targetUserId,
    score_date: seededScoreDate,
    stableford_score: seededScoreValue,
    created_by_admin: true,
  });

  if (insertScoreError) {
    setupReason = `Unable to seed target score: ${insertScoreError.message}`;
    return;
  }
}

test.describe("Admin controls deep actions", () => {
  test.setTimeout(120_000);

  test.beforeAll(async () => {
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      setupReason = "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for deterministic auth setup.";
      return;
    }

    const adminClient = createClient<AdminSeedDatabase>(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    await ensureAdminPasswordAuthReady(adminClient);
    if (setupReason) return;

    await seedTargetUserAndScore(adminClient);
    if (setupReason) return;

    setupReady = true;
  });

  test("admin can update user profile and moderate score", async ({ page }) => {
    test.skip(!setupReady, setupReason || "Admin action setup not ready.");

    await page.goto("/auth/login");
    await page.getByLabel("Email").fill(adminEmail!);
    await page.getByLabel("Password", { exact: true }).fill(adminPassword!);
    await Promise.all([
      page.waitForURL(/\/dashboard/, { timeout: 30_000, waitUntil: "commit" }),
      page.getByRole("button", { name: "Sign in with password" }).click(),
    ]);

    await page.goto("/admin");

    await page.getByRole("tab", { name: "Users" }).click();
    await expect(page.getByRole("heading", { name: "User Management" })).toBeVisible();

    await page.getByPlaceholder("Search by email, role, name, or subscription status").fill(targetEmail);

    const userCard = page.locator("article", { hasText: targetEmail }).first();
    await expect(userCard).toBeVisible();

    await userCard.getByRole("button", { name: "Edit User" }).click();

    await userCard.locator("select").selectOption("admin");
    await userCard.locator("input[placeholder='Full name']").fill(targetFullName);
    await userCard.locator("input[placeholder='Country code']").fill(targetCountry);
    await userCard.locator("input[placeholder='Timezone']").fill(targetTimezone);
    await userCard.getByRole("button", { name: "Save" }).click();

    await expect(userCard.locator("span", { hasText: "admin" })).toBeVisible({ timeout: 15000 });

    await page.getByRole("tab", { name: "Scores" }).click();
    await expect(page.getByRole("heading", { name: "Score Moderation" })).toBeVisible();

    await page.getByPlaceholder("Search by user email, score date, or value").fill(targetEmail);

    const scoreCard = page.locator("article", { hasText: targetEmail }).first();
    await expect(scoreCard).toBeVisible();
    await expect(scoreCard.locator("p", { hasText: `Score: ${seededScoreValue}` })).toBeVisible();

    await scoreCard.getByRole("button", { name: "Edit" }).click();
    await scoreCard.locator("input[type='number']").fill(String(updatedScoreValue));
    await scoreCard.getByRole("button", { name: "Save" }).click();

    await expect(scoreCard.locator("p", { hasText: `Score: ${updatedScoreValue}` })).toBeVisible({ timeout: 15000 });

    await scoreCard.getByRole("button", { name: "Delete" }).click();
    await expect(page.locator("article", { hasText: targetEmail })).toHaveCount(0, { timeout: 15000 });
  });
});
