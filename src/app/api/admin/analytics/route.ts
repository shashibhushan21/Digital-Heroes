import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type MonthBucket = {
  month: string;
  label: string;
  donation_minor: number;
  prize_minor: number;
  new_subscribers: number;
};

function monthKeyFromIso(value: string): string {
  return value.slice(0, 7);
}

function monthLabel(key: string): string {
  const date = new Date(`${key}-01T00:00:00.000Z`);
  return date.toLocaleString("en-US", { month: "short", year: "numeric" });
}

function buildMonthKeys(lastMonths: number): string[] {
  const now = new Date();
  const keys: string[] = [];

  for (let index = lastMonths - 1; index >= 0; index -= 1) {
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth() - index;
    const current = new Date(Date.UTC(year, month, 1));
    keys.push(`${current.getUTCFullYear()}-${String(current.getUTCMonth() + 1).padStart(2, "0")}`);
  }

  return keys;
}

export async function GET() {
  await requireAdmin();

  const supabase = createSupabaseAdminClient();

  const monthKeys = buildMonthKeys(6);
  const periodStartIso = `${monthKeys[0]}-01T00:00:00.000Z`;
  const nowIso = new Date().toISOString();

  const [
    usersCountResult,
    subscriberUsersCountResult,
    activeSubsCountResult,
    drawsCountResult,
    winnersCountResult,
    pendingVerificationsCountResult,
    pendingPayoutsCountResult,
    donationsResult,
    prizePoolsResult,
    newSubscriptionsResult,
  ] = await Promise.all([
    supabase.from("users").select("id", { count: "exact", head: true }),
    supabase.from("users").select("id", { count: "exact", head: true }).eq("role", "subscriber"),
    supabase
      .from("subscriptions")
      .select("id", { count: "exact", head: true })
      .in("status", ["active", "trialing"])
      .gte("current_period_end", nowIso),
    supabase.from("draws").select("id", { count: "exact", head: true }).eq("status", "published"),
    supabase.from("winners").select("id", { count: "exact", head: true }),
    supabase.from("winner_verifications").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("payouts").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase
      .from("donations")
      .select("amount_minor,created_at,charity_id,charities(name)")
      .gte("created_at", periodStartIso),
    supabase.from("prize_pools").select("gross_pool_minor,computed_at").gte("computed_at", periodStartIso),
    supabase.from("subscriptions").select("started_at").gte("started_at", periodStartIso),
  ]);

  const countErrors = [
    usersCountResult.error,
    subscriberUsersCountResult.error,
    activeSubsCountResult.error,
    drawsCountResult.error,
    winnersCountResult.error,
    pendingVerificationsCountResult.error,
    pendingPayoutsCountResult.error,
    donationsResult.error,
    prizePoolsResult.error,
    newSubscriptionsResult.error,
  ].filter(Boolean);

  if (countErrors.length > 0) {
    return NextResponse.json({ error: countErrors[0]?.message ?? "Unable to compute analytics." }, { status: 500 });
  }

  const monthMap = new Map<string, MonthBucket>(
    monthKeys.map((key) => [
      key,
      {
        month: key,
        label: monthLabel(key),
        donation_minor: 0,
        prize_minor: 0,
        new_subscribers: 0,
      },
    ]),
  );

  const charityTotals = new Map<string, { charity_id: string; charity_name: string; amount_minor: number }>();

  for (const donation of donationsResult.data ?? []) {
    if (!donation.created_at) continue;

    const key = monthKeyFromIso(donation.created_at);
    const bucket = monthMap.get(key);
    if (bucket) {
      bucket.donation_minor += donation.amount_minor ?? 0;
    }

    const charityId = donation.charity_id;
    const charityName = Array.isArray(donation.charities)
      ? donation.charities[0]?.name
      : (donation.charities as { name?: string } | null)?.name;

    if (charityId) {
      const current = charityTotals.get(charityId);
      if (current) {
        current.amount_minor += donation.amount_minor ?? 0;
      } else {
        charityTotals.set(charityId, {
          charity_id: charityId,
          charity_name: charityName ?? "Unknown charity",
          amount_minor: donation.amount_minor ?? 0,
        });
      }
    }
  }

  for (const pool of prizePoolsResult.data ?? []) {
    if (!pool.computed_at) continue;

    const key = monthKeyFromIso(pool.computed_at);
    const bucket = monthMap.get(key);
    if (bucket) {
      bucket.prize_minor += pool.gross_pool_minor ?? 0;
    }
  }

  for (const subscription of newSubscriptionsResult.data ?? []) {
    if (!subscription.started_at) continue;

    const key = monthKeyFromIso(subscription.started_at);
    const bucket = monthMap.get(key);
    if (bucket) {
      bucket.new_subscribers += 1;
    }
  }

  const monthlySeries = monthKeys.map((key) => monthMap.get(key) as MonthBucket);
  const topCharities = [...charityTotals.values()].sort((a, b) => b.amount_minor - a.amount_minor).slice(0, 5);

  const totals = {
    users: usersCountResult.count ?? 0,
    subscriber_users: subscriberUsersCountResult.count ?? 0,
    active_subscribers: activeSubsCountResult.count ?? 0,
    published_draws: drawsCountResult.count ?? 0,
    winners: winnersCountResult.count ?? 0,
    pending_verifications: pendingVerificationsCountResult.count ?? 0,
    pending_payouts: pendingPayoutsCountResult.count ?? 0,
    donation_last_6_months_minor: monthlySeries.reduce((sum, row) => sum + row.donation_minor, 0),
    prize_last_6_months_minor: monthlySeries.reduce((sum, row) => sum + row.prize_minor, 0),
  };

  return NextResponse.json({
    totals,
    monthlySeries,
    topCharities,
  });
}
