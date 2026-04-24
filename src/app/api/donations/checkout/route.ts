import { NextResponse } from "next/server";
import Stripe from "stripe";
import { z } from "zod";
import { publicEnv, serverEnv } from "@/lib/config/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  charityId: z.uuid(),
  amountMajor: z.number().min(1).max(5000),
  donorEmail: z.email().optional(),
});

export async function POST(request: Request) {
  if (!serverEnv.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Stripe secret key is not configured." }, { status: 500 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid donation payload." }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: charity, error: charityError } = await supabase
    .from("charities")
    .select("id,name,is_active")
    .eq("id", parsed.data.charityId)
    .maybeSingle();

  if (charityError) {
    return NextResponse.json({ error: charityError.message }, { status: 500 });
  }

  if (!charity || !charity.is_active) {
    return NextResponse.json({ error: "Selected charity is not available." }, { status: 400 });
  }

  if (!user && !parsed.data.donorEmail) {
    return NextResponse.json({ error: "Email is required for guest donation checkout." }, { status: 400 });
  }

  const stripe = new Stripe(serverEnv.STRIPE_SECRET_KEY);
  const amountMinor = Math.round(parsed.data.amountMajor * 100);

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    customer_email: user?.email ?? parsed.data.donorEmail,
    success_url: `${publicEnv.NEXT_PUBLIC_APP_URL}/charities?donation=success`,
    cancel_url: `${publicEnv.NEXT_PUBLIC_APP_URL}/charities?donation=cancel`,
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `Donation to ${charity.name}`,
            description: "Independent charity donation",
          },
          unit_amount: amountMinor,
        },
        quantity: 1,
      },
    ],
    metadata: {
      source_type: "independent_donation",
      charity_id: parsed.data.charityId,
      user_id: user?.id ?? "",
    },
  });

  if (!session.url) {
    return NextResponse.json({ error: "Unable to create donation checkout session." }, { status: 500 });
  }

  return NextResponse.json({ url: session.url });
}
