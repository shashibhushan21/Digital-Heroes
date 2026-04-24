import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth/roles";
import { isActiveSubscriptionStatus } from "@/lib/billing/plans";
import { ensurePublicUserRecord } from "@/lib/auth/provision-user";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function toAppRole(value: unknown): "admin" | "subscriber" | null {
  if (value === "admin" || value === "subscriber") {
    return value;
  }
  return null;
}

type SubscriptionRow = {
  status: string | null;
  current_period_end: string | null;
};

async function resolveUserRoleWithFallback(userId: string, roleFromMetadata: "admin" | "subscriber" | null) {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.from("users").select("role").eq("id", userId).maybeSingle();
  const dbRole = toAppRole(data?.role);

  if (roleFromMetadata === "admin" || dbRole === "admin") {
    return "admin";
  }

  return roleFromMetadata ?? dbRole ?? "subscriber";
}

export async function getCurrentUser() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const metadataRole = toAppRole(user.app_metadata?.role ?? user.user_metadata?.role);
  const resolvedRole = await resolveUserRoleWithFallback(user.id, metadataRole);

  const userWithResolvedRole =
    resolvedRole !== metadataRole
      ? {
          ...user,
          user_metadata: {
            ...(user.user_metadata ?? {}),
            role: resolvedRole,
          },
        }
      : user;

  await ensurePublicUserRecord(userWithResolvedRole);

  return userWithResolvedRole;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/auth/login");
  }
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  const role = toAppRole(user.app_metadata?.role ?? user.user_metadata?.role);

  if (!isAdmin(role)) {
    redirect("/dashboard");
  }

  return user;
}

export async function hasActiveSubscription(userId: string): Promise<boolean> {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from("subscriptions")
    .select("status,current_period_end")
    .eq("user_id", userId)
    .order("current_period_end", { ascending: false })
    .limit(1);

  if (error || !data || data.length === 0) {
    return false;
  }

  const subscription = data[0] as SubscriptionRow;
  const activeStatus = isActiveSubscriptionStatus(subscription.status);

  if (!activeStatus) {
    return false;
  }

  if (!subscription.current_period_end) {
    return activeStatus;
  }

  return new Date(subscription.current_period_end) >= new Date();
}

export async function requireActiveSubscription() {
  const user = await requireUser();
  const role = toAppRole(user.user_metadata?.role);

  if (isAdmin(role)) {
    return user;
  }

  const hasAccess = await hasActiveSubscription(user.id);

  if (!hasAccess) {
    redirect("/subscribe");
  }

  return user;
}
