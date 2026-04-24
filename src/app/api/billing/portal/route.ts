import { NextResponse } from "next/server";
import Stripe from "stripe";
import { publicEnv, serverEnv } from "@/lib/config/env";
import { getCurrentUser } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST() {
  if (!serverEnv.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Stripe secret key is not configured." }, { status: 500 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const supabase = await createServerSupabaseClient();
  const { data: subscription, error: subscriptionError } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id,status")
    .eq("user_id", user.id)
    .order("current_period_end", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (subscriptionError) {
    return NextResponse.json({ error: subscriptionError.message }, { status: 500 });
  }

  if (!subscription?.stripe_customer_id) {
    return NextResponse.json({ error: "No Stripe customer found for this account." }, { status: 400 });
  }

  const stripe = new Stripe(serverEnv.STRIPE_SECRET_KEY);
  const session = await stripe.billingPortal.sessions.create({
    customer: subscription.stripe_customer_id,
    return_url: `${publicEnv.NEXT_PUBLIC_APP_URL}/dashboard/settings`,
  });

  if (!session.url) {
    return NextResponse.json({ error: "Unable to open billing portal." }, { status: 500 });
  }

  return NextResponse.json({ url: session.url });
}
