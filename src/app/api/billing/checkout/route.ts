import { NextResponse } from "next/server";
import Stripe from "stripe";
import { z } from "zod";
import { PLAN_CODES, type PlanCode } from "@/lib/billing/plans";
import { publicEnv, serverEnv } from "@/lib/config/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  planCode: z.enum([PLAN_CODES.monthly, PLAN_CODES.yearly]),
});

function resolvePriceId(planCode: PlanCode): string | null {
  if (planCode === PLAN_CODES.monthly) {
    return serverEnv.STRIPE_PRICE_MONTHLY_ID ?? null;
  }
  return serverEnv.STRIPE_PRICE_YEARLY_ID ?? null;
}

export async function POST(request: Request) {
  if (!serverEnv.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Stripe secret key is not configured." }, { status: 500 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const priceId = resolvePriceId(parsed.data.planCode);
  if (!priceId) {
    return NextResponse.json({ error: "Requested plan is not configured." }, { status: 500 });
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const stripe = new Stripe(serverEnv.STRIPE_SECRET_KEY);
  const requestOrigin = new URL(request.url).origin;
  const baseUrl = requestOrigin || publicEnv.NEXT_PUBLIC_APP_URL;
  const successUrl = `${baseUrl}/subscribe?checkout=success`;
  const cancelUrl = `${baseUrl}/subscribe?checkout=cancel`;

  const customer = await stripe.customers.create({
    email: user.email,
    metadata: {
      user_id: user.id,
    },
  });

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customer.id,
    success_url: successUrl,
    cancel_url: cancelUrl,
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: {
      metadata: {
        user_id: user.id,
        plan_code: parsed.data.planCode,
      },
    },
    metadata: {
      user_id: user.id,
      plan_code: parsed.data.planCode,
    },
  });

  if (!session.url) {
    return NextResponse.json({ error: "Unable to create checkout session." }, { status: 500 });
  }

  return NextResponse.json({ url: session.url });
}
