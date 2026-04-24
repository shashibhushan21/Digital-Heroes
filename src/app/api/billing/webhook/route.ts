import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/config/env";

export const runtime = "nodejs";

const subscriptionEventTypes = new Set([
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
]);

const donationEventTypes = new Set(["checkout.session.completed"]);
const activeSubscriptionStatuses = new Set(["active", "trialing"]);
const lapsedSubscriptionStatuses = new Set(["past_due", "unpaid", "incomplete_expired", "paused"]);

type SubscriptionLifecycleNotification = {
  eventType: string;
  templateCode: string;
  payload: Record<string, unknown>;
};

function timestampFromUnix(value: number | null): string | null {
  if (!value) return null;
  return new Date(value * 1000).toISOString();
}

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

function resolveStripeCustomerId(event: Stripe.Event): string {
  const eventObject = event.data.object as { customer?: string | Stripe.Customer | Stripe.DeletedCustomer };
  if (typeof eventObject.customer === "string") {
    return eventObject.customer;
  }
  if (eventObject.customer && "id" in eventObject.customer) {
    return eventObject.customer.id;
  }
  return "unknown";
}

function readPreviousAttributes(event: Stripe.Event): Record<string, unknown> | null {
  const candidate = (event.data as { previous_attributes?: unknown }).previous_attributes;
  if (candidate && typeof candidate === "object") {
    return candidate as Record<string, unknown>;
  }
  return null;
}

function readPreviousStatus(previousAttributes: Record<string, unknown> | null): string | null {
  const value = previousAttributes?.status;
  return typeof value === "string" ? value : null;
}

function hasChanged(previousAttributes: Record<string, unknown> | null, key: string): boolean {
  return previousAttributes ? Object.prototype.hasOwnProperty.call(previousAttributes, key) : false;
}

function isActiveStatus(status: string | null | undefined): boolean {
  return typeof status === "string" && activeSubscriptionStatuses.has(status);
}

function isLapsedStatus(status: string | null | undefined): boolean {
  return typeof status === "string" && lapsedSubscriptionStatuses.has(status);
}

function resolveSubscriptionLifecycleNotification(
  event: Stripe.Event,
  subscription: Stripe.Subscription,
  planCode: "monthly" | "yearly" | null,
  currentPeriodEnd: string,
): SubscriptionLifecycleNotification | null {
  const payload = {
    stripeSubscriptionId: subscription.id,
    planCode,
    status: subscription.status,
    currentPeriodEnd,
    cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
  } satisfies Record<string, unknown>;

  if (event.type === "customer.subscription.created") {
    if (!isActiveStatus(subscription.status)) {
      return null;
    }

    return {
      eventType: "subscription.activated",
      templateCode: "subscription_activated",
      payload,
    };
  }

  if (event.type === "customer.subscription.deleted") {
    return {
      eventType: "subscription.canceled",
      templateCode: "subscription_canceled",
      payload,
    };
  }

  if (event.type !== "customer.subscription.updated") {
    return null;
  }

  const previousAttributes = readPreviousAttributes(event);
  const previousStatus = readPreviousStatus(previousAttributes);

  if (hasChanged(previousAttributes, "cancel_at_period_end") && subscription.cancel_at_period_end) {
    return {
      eventType: "subscription.canceled",
      templateCode: "subscription_canceled",
      payload,
    };
  }

  if (previousStatus !== subscription.status && isLapsedStatus(subscription.status)) {
    return {
      eventType: "subscription.lapsed",
      templateCode: "subscription_lapsed",
      payload,
    };
  }

  if (previousStatus && !isActiveStatus(previousStatus) && isActiveStatus(subscription.status)) {
    return {
      eventType: "subscription.activated",
      templateCode: "subscription_activated",
      payload,
    };
  }

  if (isActiveStatus(subscription.status) && hasChanged(previousAttributes, "current_period_end")) {
    return {
      eventType: "subscription.renewed",
      templateCode: "subscription_renewed",
      payload,
    };
  }

  return null;
}

export async function POST(request: Request) {
  try {
    if (!serverEnv.STRIPE_SECRET_KEY || !serverEnv.STRIPE_WEBHOOK_SECRET) {
      console.error("[billing-webhook] missing Stripe environment configuration");
      return NextResponse.json({ error: "Stripe webhook environment is not configured." }, { status: 500 });
    }

    const stripe = new Stripe(serverEnv.STRIPE_SECRET_KEY);
    const signature = request.headers.get("stripe-signature");

    if (!signature) {
      console.error("[billing-webhook] missing stripe-signature header");
      return NextResponse.json({ error: "Missing stripe-signature header." }, { status: 400 });
    }

    const rawBody = await request.text();

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, serverEnv.STRIPE_WEBHOOK_SECRET);
    } catch (error) {
      console.error("[billing-webhook] signature verification failed", error);
      return NextResponse.json({ error: `Invalid webhook signature: ${String(error)}` }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();

    const { data: existing } = await supabase
      .from("billing_events")
      .select("id")
      .eq("stripe_event_id", event.id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ received: true, idempotent: true });
    }

    const eventObject = event.data.object as Partial<Stripe.Subscription>;

    const { error: billingEventError } = await supabase.from("billing_events").insert({
      stripe_event_id: event.id,
      event_type: event.type,
      stripe_customer_id: resolveStripeCustomerId(event),
      stripe_subscription_id: eventObject.id ?? null,
      payload_json: event as unknown as Record<string, unknown>,
      process_status: "processed",
      processed_at: new Date().toISOString(),
    });

    if (billingEventError) {
      console.error("[billing-webhook] billing_events insert failed", {
        eventId: event.id,
        eventType: event.type,
        error: billingEventError.message,
      });
      return NextResponse.json({ error: billingEventError.message }, { status: 500 });
    }

    if (subscriptionEventTypes.has(event.type)) {
      const subscription = event.data.object as Stripe.Subscription & {
        current_period_start?: number | null;
        current_period_end?: number | null;
      };
      const userId = subscription.metadata?.user_id ?? null;

      if (!userId) {
        return NextResponse.json({
          received: true,
          warning: "Subscription event recorded, but user_id metadata is missing.",
        });
      }

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
      const planCode = resolvePlanCode(subscription);

      const { error: subscriptionError } = await supabase.from("subscriptions").upsert(
        {
          user_id: userId,
          plan_code: planCode,
          stripe_customer_id:
            typeof subscription.customer === "string"
              ? subscription.customer
              : subscription.customer.id,
          stripe_subscription_id: subscription.id,
          status: subscription.status,
          started_at: startedAt,
          current_period_start: periodStart,
          current_period_end: periodEnd,
          canceled_at: timestampFromUnix(subscription.canceled_at),
          ended_at: timestampFromUnix(subscription.ended_at),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "stripe_subscription_id" },
      );

      if (subscriptionError) {
        console.error("[billing-webhook] subscriptions upsert failed", {
          eventId: event.id,
          subscriptionId: subscription.id,
          userId,
          error: subscriptionError.message,
        });
        return NextResponse.json({ error: subscriptionError.message }, { status: 500 });
      }

      const lifecycleNotification = resolveSubscriptionLifecycleNotification(
        event,
        subscription,
        planCode,
        periodEnd,
      );

      if (lifecycleNotification) {
        const { error: notificationError } = await supabase.from("notifications").insert({
          user_id: userId,
          channel: "email",
          event_type: lifecycleNotification.eventType,
          template_code: lifecycleNotification.templateCode,
          payload_json: lifecycleNotification.payload,
          delivery_status: "queued",
        });

        if (notificationError) {
          console.error("[billing-webhook] notifications insert failed", {
            eventId: event.id,
            subscriptionId: subscription.id,
            userId,
            eventType: lifecycleNotification.eventType,
            error: notificationError.message,
          });
        }
      }
    }

    if (donationEventTypes.has(event.type)) {
      const session = event.data.object as Stripe.Checkout.Session;
      const sourceType = session.metadata?.source_type;

      if (session.mode === "payment" && sourceType === "independent_donation") {
        const charityId = session.metadata?.charity_id;
        const userId = session.metadata?.user_id || null;
        const amountMinor = session.amount_total ?? 0;
        const currency = (session.currency ?? "usd").toUpperCase();

        if (charityId && amountMinor > 0) {
          const { error: donationError } = await supabase.from("donations").insert({
            user_id: userId,
            charity_id: charityId,
            source_type: "independent",
            amount_minor: amountMinor,
            currency,
            reference_type: "manual_checkout",
            reference_id: session.id,
          });

          if (donationError) {
            console.error("[billing-webhook] donations insert failed", {
              eventId: event.id,
              sessionId: session.id,
              charityId,
              userId,
              error: donationError.message,
            });
            return NextResponse.json({ error: donationError.message }, { status: 500 });
          }
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[billing-webhook] unexpected failure", error);
    return NextResponse.json({ error: "Unexpected webhook failure." }, { status: 500 });
  }
}
