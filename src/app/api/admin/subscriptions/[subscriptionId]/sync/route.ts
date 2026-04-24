import { NextResponse } from "next/server";
import Stripe from "stripe";
import { requireAdmin } from "@/lib/auth/session";
import { serverEnv } from "@/lib/config/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function timestampFromUnixMaybe(value: number | null | undefined): string | null {
  if (!value) return null;
  return new Date(value * 1000).toISOString();
}

function addMonthsIso(isoTimestamp: string, months: number): string {
  const date = new Date(isoTimestamp);
  date.setMonth(date.getMonth() + months);
  return date.toISOString();
}

function resolvePlanCode(subscription: Stripe.Subscription): "monthly" | "yearly" | null {
  const metadataPlan = subscription.metadata?.plan_code;
  if (metadataPlan === "monthly" || metadataPlan === "yearly") {
    return metadataPlan;
  }

  const priceId = subscription.items.data[0]?.price?.id;
  if (priceId && priceId === serverEnv.STRIPE_PRICE_MONTHLY_ID) return "monthly";
  if (priceId && priceId === serverEnv.STRIPE_PRICE_YEARLY_ID) return "yearly";
  return null;
}

type Context = {
  params: Promise<{ subscriptionId: string }>;
};

export async function POST(_request: Request, context: Context) {
  await requireAdmin();

  if (!serverEnv.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Stripe secret key is not configured." }, { status: 500 });
  }

  const { subscriptionId } = await context.params;
  const supabase = createSupabaseAdminClient();

  const { data: current, error: currentError } = await supabase
    .from("subscriptions")
    .select("id,user_id,stripe_subscription_id")
    .eq("id", subscriptionId)
    .maybeSingle();

  if (currentError) {
    return NextResponse.json({ error: currentError.message }, { status: 500 });
  }

  if (!current) {
    return NextResponse.json({ error: "Subscription not found." }, { status: 404 });
  }

  const stripe = new Stripe(serverEnv.STRIPE_SECRET_KEY);
  const subscription = (await stripe.subscriptions.retrieve(current.stripe_subscription_id)) as Stripe.Subscription & {
    current_period_start?: number | null;
    current_period_end?: number | null;
  };

  const firstItem = subscription.items.data[0] as Stripe.SubscriptionItem & {
    current_period_start?: number | null;
    current_period_end?: number | null;
  };

  const startedAt = timestampFromUnixMaybe(subscription.start_date) ?? new Date().toISOString();
  const periodStart =
    timestampFromUnixMaybe(subscription.current_period_start) ??
    timestampFromUnixMaybe(firstItem?.current_period_start) ??
    startedAt;

  const periodEnd =
    timestampFromUnixMaybe(subscription.current_period_end) ??
    timestampFromUnixMaybe(firstItem?.current_period_end) ??
    addMonthsIso(periodStart, 1);

  const { data: updated, error: updateError } = await supabase
    .from("subscriptions")
    .update({
      plan_code: resolvePlanCode(subscription),
      stripe_customer_id:
        typeof subscription.customer === "string"
          ? subscription.customer
          : subscription.customer.id,
      status: subscription.status,
      started_at: startedAt,
      current_period_start: periodStart,
      current_period_end: periodEnd,
      canceled_at: timestampFromUnixMaybe(subscription.canceled_at),
      ended_at: timestampFromUnixMaybe(subscription.ended_at),
      updated_at: new Date().toISOString(),
    })
    .eq("id", current.id)
    .select("id,status,plan_code,current_period_end,updated_at")
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ subscription: updated });
}
