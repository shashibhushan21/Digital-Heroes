"use client";

import { useQuery } from "@tanstack/react-query";
import { AnimatedCard } from "@/components/ui/animated-surface";

type StatusResponse = {
  subscription: {
    status: string;
    plan_code: string | null;
    current_period_end: string;
  } | null;
  hasAccess: boolean;
  error?: string;
};

async function getSubscriptionStatus(): Promise<StatusResponse> {
  const response = await fetch("/api/subscription/status");
  const payload = (await response.json()) as StatusResponse;

  if (!response.ok) {
    throw new Error(payload.error ?? "Unable to fetch subscription status.");
  }

  return payload;
}

export function SubscriptionStatusCard() {
  const query = useQuery({
    queryKey: ["subscription-status"],
    queryFn: getSubscriptionStatus,
  });

  return (
    <AnimatedCard className="p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Billing</p>
          <h2 className="mt-1 font-display text-2xl text-slate-950">Subscription Status</h2>
        </div>
        <div className={`rounded-full px-3 py-1 text-xs font-semibold ${query.data?.hasAccess ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
          {query.data?.hasAccess ? "Active" : "Needs attention"}
        </div>
      </div>
      {query.isLoading ? <p className="mt-3 text-sm text-slate-600">Loading subscription...</p> : null}
      {query.error ? <p className="mt-3 text-sm text-red-600">{(query.error as Error).message}</p> : null}

      {query.data ? (
        <div className="mt-4 grid gap-3 text-sm text-slate-700 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Access</p>
            <p className="mt-1 font-semibold text-slate-950">{query.data.hasAccess ? "Active" : "Inactive"}</p>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Plan</p>
            <p className="mt-1 font-semibold text-slate-950">{query.data.subscription?.plan_code ?? "Not set"}</p>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Renewal</p>
            <p className="mt-1 font-semibold text-slate-950">{query.data.subscription?.current_period_end ?? "N/A"}</p>
          </div>
        </div>
      ) : null}
    </AnimatedCard>
  );
}
