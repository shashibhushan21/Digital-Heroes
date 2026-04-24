import type { User as SupabaseAuthUser } from "@supabase/supabase-js";
import { serverEnv } from "@/lib/config/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function resolveRole(user: SupabaseAuthUser): "subscriber" | "admin" {
  const configuredAdminEmail = serverEnv.ADMIN_EMAIL?.trim().toLowerCase();
  const userEmail = user.email?.trim().toLowerCase();

  if (configuredAdminEmail && userEmail && configuredAdminEmail === userEmail) {
    return "admin";
  }

  const role = user.app_metadata?.role ?? user.user_metadata?.role;
  if (role === "admin") return "admin";
  return "subscriber";
}

export async function ensurePublicUserRecord(user: SupabaseAuthUser): Promise<void> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return;
  }

  const adminClient = createSupabaseAdminClient();
  await adminClient.from("users").upsert(
    {
      id: user.id,
      email: user.email ?? `${user.id}@placeholder.local`,
      role: resolveRole(user),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );
}
