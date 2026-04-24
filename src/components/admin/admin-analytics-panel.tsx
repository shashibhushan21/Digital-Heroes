"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnimatedCard } from "@/components/ui/animated-surface";

type AnalyticsResponse = {
  totals: {
    users: number;
    subscriber_users: number;
    active_subscribers: number;
    published_draws: number;
    winners: number;
    pending_verifications: number;
    pending_payouts: number;
    donation_last_6_months_minor: number;
    prize_last_6_months_minor: number;
  };
  monthlySeries: Array<{
    month: string;
    label: string;
    donation_minor: number;
    prize_minor: number;
    new_subscribers: number;
  }>;
  topCharities: Array<{
    charity_id: string;
    charity_name: string;
    amount_minor: number;
  }>;
  error?: string;
};

async function getAdminAnalytics(): Promise<AnalyticsResponse> {
  const response = await fetch("/api/admin/analytics");
  const payload = (await response.json()) as AnalyticsResponse;
  if (!response.ok) {
    throw new Error(payload.error ?? "Unable to fetch admin analytics.");
  }
  return payload;
}

function formatMinor(value: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value / 100);
}

export function AdminAnalyticsPanel() {
  const analyticsQuery = useQuery({
    queryKey: ["admin-analytics"],
    queryFn: getAdminAnalytics,
    refetchInterval: 30_000,
  });

  const maxCombined = useMemo(() => {
    const rows = analyticsQuery.data?.monthlySeries ?? [];
    if (!rows.length) return 1;
    return Math.max(
      ...rows.map((row) => row.donation_minor + row.prize_minor),
      1,
    );
  }, [analyticsQuery.data?.monthlySeries]);

  return (
    <AnimatedCard className="p-6">
      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Insights</p>
      <h2 className="mt-1 font-display text-2xl text-slate-950">Analytics & Reports</h2>
      <p className="mt-1 text-sm text-slate-600">Live operational totals and six-month trend snapshots.</p>

      {analyticsQuery.isLoading ? <p className="mt-3 text-sm text-slate-600">Loading analytics...</p> : null}
      {analyticsQuery.error ? (
        <p className="mt-3 text-sm text-red-600">{(analyticsQuery.error as Error).message}</p>
      ) : null}

      {analyticsQuery.data ? (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <article className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 transition hover:border-slate-300 hover:bg-white">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Total users</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{analyticsQuery.data.totals.users}</p>
            </article>
            <article className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 transition hover:border-slate-300 hover:bg-white">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Subscriber users</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{analyticsQuery.data.totals.subscriber_users}</p>
            </article>
            <article className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 transition hover:border-slate-300 hover:bg-white">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Active subscriptions</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{analyticsQuery.data.totals.active_subscribers}</p>
            </article>
            <article className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 transition hover:border-slate-300 hover:bg-white">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Published draws</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{analyticsQuery.data.totals.published_draws}</p>
            </article>
            <article className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 transition hover:border-slate-300 hover:bg-white">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Total winners</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{analyticsQuery.data.totals.winners}</p>
            </article>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <article className="rounded-2xl border border-amber-200 bg-amber-50 p-4 transition hover:border-amber-300 hover:bg-amber-100/60">
              <p className="text-xs uppercase tracking-[0.18em] text-amber-700">Pending verifications</p>
              <p className="mt-1 text-2xl font-semibold text-amber-900">{analyticsQuery.data.totals.pending_verifications}</p>
            </article>
            <article className="rounded-2xl border border-amber-200 bg-amber-50 p-4 transition hover:border-amber-300 hover:bg-amber-100/60">
              <p className="text-xs uppercase tracking-[0.18em] text-amber-700">Pending payouts</p>
              <p className="mt-1 text-2xl font-semibold text-amber-900">{analyticsQuery.data.totals.pending_payouts}</p>
            </article>
            <article className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 transition hover:border-emerald-300 hover:bg-emerald-100/60 sm:col-span-2">
              <p className="text-xs uppercase tracking-[0.18em] text-emerald-700">Donations (last 6 months)</p>
              <p className="mt-1 text-2xl font-semibold text-emerald-900">
                {formatMinor(analyticsQuery.data.totals.donation_last_6_months_minor)}
              </p>
            </article>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <article className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 transition hover:border-slate-300 hover:bg-white">
              <h3 className="text-sm font-semibold text-slate-950">6-Month Financial Trend</h3>
              <p className="mt-1 text-xs text-slate-600">Combined bars: donations + prize pools (gross).</p>

              <div className="mt-4 space-y-3">
                {analyticsQuery.data.monthlySeries.map((row) => {
                  const combined = row.donation_minor + row.prize_minor;
                  const widthPercent = (combined / maxCombined) * 100;
                  return (
                    <div key={row.month}>
                      <div className="mb-1 flex items-center justify-between text-xs text-slate-600">
                        <span>{row.label}</span>
                        <span>{formatMinor(combined)}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-slate-900" style={{ width: `${widthPercent}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </article>

            <article className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 transition hover:border-slate-300 hover:bg-white">
              <h3 className="text-sm font-semibold text-slate-950">Top Charities (Donations)</h3>
              <p className="mt-1 text-xs text-slate-600">Based on independent donations processed in last 6 months.</p>

              <div className="mt-4 space-y-3">
                {analyticsQuery.data.topCharities.map((charity, index) => (
                  <div key={charity.charity_id} className="flex items-center justify-between text-sm">
                    <span className="text-slate-700">{index + 1}. {charity.charity_name}</span>
                    <span className="font-semibold text-slate-900">{formatMinor(charity.amount_minor)}</span>
                  </div>
                ))}
                {!analyticsQuery.data.topCharities.length ? (
                  <p className="text-sm text-slate-600">No donation data available yet.</p>
                ) : null}
              </div>
            </article>
          </div>
        </>
      ) : null}
    </AnimatedCard>
  );
}
