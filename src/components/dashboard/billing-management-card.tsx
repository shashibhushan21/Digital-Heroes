"use client";

import { useMutation } from "@tanstack/react-query";
import { AnimatedCard } from "@/components/ui/animated-surface";

export function BillingManagementCard() {
  const portalMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/billing/portal", {
        method: "POST",
      });

      const payload = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !payload.url) {
        throw new Error(payload.error ?? "Unable to open billing portal.");
      }

      return payload.url;
    },
    onSuccess: (url) => {
      window.location.href = url;
    },
  });

  return (
    <AnimatedCard className="p-6">
      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Billing</p>
      <h2 className="mt-1 font-display text-2xl text-slate-950">Billing & Cancellation</h2>
      <p className="mt-1 text-sm text-slate-600">
        Open Stripe Customer Portal to change payment method, switch plans, or cancel your subscription safely.
      </p>

      <button
        type="button"
        onClick={() => portalMutation.mutate()}
        disabled={portalMutation.isPending}
        className="mt-5 rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_35px_-18px_rgba(16,32,58,0.75)] hover:bg-slate-800 disabled:opacity-70"
      >
        {portalMutation.isPending ? "Opening..." : "Manage Billing"}
      </button>

      <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 transition hover:border-amber-300 hover:bg-amber-100/60">
        <p className="text-sm font-semibold text-amber-900">Cancel subscription</p>
        <p className="mt-1 text-sm text-amber-800">
          Cancellation is completed inside Stripe Customer Portal. Your access remains active until period end.
        </p>
        <button
          type="button"
          disabled={portalMutation.isPending}
          onClick={() => {
            const confirmed = window.confirm(
              "You are about to open Stripe to cancel your subscription. Continue?",
            );
            if (confirmed) {
              portalMutation.mutate();
            }
          }}
          className="mt-3 rounded-full border border-amber-300 px-4 py-2 text-sm font-semibold text-amber-900 hover:border-amber-400 hover:bg-white disabled:opacity-70"
        >
          Continue To Cancel
        </button>
      </div>

      {portalMutation.error ? <p className="mt-3 text-sm text-red-600">{(portalMutation.error as Error).message}</p> : null}
    </AnimatedCard>
  );
}
