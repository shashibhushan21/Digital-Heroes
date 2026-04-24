import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type SubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "incomplete"
  | "incomplete_expired"
  | "paused";

export async function GET(request: NextRequest) {
  await requireAdmin();

  const searchParams = request.nextUrl.searchParams;
  const statusFilter = searchParams.get("status") as SubscriptionStatus | null;

  const supabase = createSupabaseAdminClient();

  let query = supabase
    .from("subscriptions")
    .select(
      "id,user_id,plan_code,status,current_period_start,current_period_end,canceled_at,ended_at,stripe_customer_id,stripe_subscription_id,updated_at,users(email)",
    )
    .order("current_period_end", { ascending: false })
    .limit(200);

  if (statusFilter) {
    query = query.eq("status", statusFilter);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const summary: Record<string, number> = {
    active: 0,
    trialing: 0,
    past_due: 0,
    canceled: 0,
    unpaid: 0,
    incomplete: 0,
    incomplete_expired: 0,
    paused: 0,
  };

  for (const row of data ?? []) {
    const key = String(row.status);
    summary[key] = (summary[key] ?? 0) + 1;
  }

  return NextResponse.json({
    summary,
    subscriptions: data ?? [],
  });
}
