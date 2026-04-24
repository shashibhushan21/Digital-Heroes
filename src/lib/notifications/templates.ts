type NotificationPayload = Record<string, unknown>;

type NotificationTemplate = {
  subject: string;
  text: string;
};

function readString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0 ? value : fallback;
}

function readPlanLabel(value: unknown): string {
  if (value === "monthly") return "monthly";
  if (value === "yearly") return "yearly";
  return "current";
}

function readIsoDate(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return parsed.toISOString().slice(0, 10);
}

export function buildNotificationTemplate(eventType: string, payload: NotificationPayload): NotificationTemplate {
  switch (eventType) {
    case "winner.verification.submitted": {
      const winnerId = readString(payload.winnerId, "your winner record");
      return {
        subject: "Verification submitted",
        text: `Your winner verification was submitted for ${winnerId}. We will review your proof shortly.`,
      };
    }
    case "winner.verification.approved": {
      return {
        subject: "Verification approved",
        text: "Your winner verification has been approved. Your payout is now being prepared.",
      };
    }
    case "winner.verification.rejected": {
      return {
        subject: "Verification requires update",
        text: "Your winner verification was rejected. Please upload an updated proof document from your dashboard.",
      };
    }
    case "winner.payout.paid": {
      const paymentReference = readString(payload.paymentReference, "N/A");
      return {
        subject: "Payout sent",
        text: `Your winner payout has been marked as paid. Payment reference: ${paymentReference}.`,
      };
    }
    case "subscription.activated": {
      const plan = readPlanLabel(payload.planCode);
      const renewalDate = readIsoDate(payload.currentPeriodEnd, "your renewal date");
      return {
        subject: "Subscription activated",
        text: `Your ${plan} subscription is active. Your next renewal date is ${renewalDate}.`,
      };
    }
    case "subscription.renewed": {
      const plan = readPlanLabel(payload.planCode);
      const renewalDate = readIsoDate(payload.currentPeriodEnd, "your next billing date");
      return {
        subject: "Subscription renewed",
        text: `Your ${plan} subscription has renewed successfully. Your next billing date is ${renewalDate}.`,
      };
    }
    case "subscription.canceled": {
      const endDate = readIsoDate(payload.currentPeriodEnd, "the end of your billing period");
      return {
        subject: "Subscription canceled",
        text: `Your subscription has been canceled and will end on ${endDate}. You can reactivate anytime from your billing settings.`,
      };
    }
    case "subscription.lapsed": {
      return {
        subject: "Subscription lapsed",
        text: "Your subscription is no longer active due to a billing issue. Update your payment method to restore access.",
      };
    }
    default: {
      return {
        subject: "Digital Heros update",
        text: "You have a new account notification. Please check your dashboard for details.",
      };
    }
  }
}
