"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatedCard } from "@/components/ui/animated-surface";

type SubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "incomplete"
  | "incomplete_expired"
  | "paused";

type SubscriptionRow = {
  id: string;
  plan_code: string | null;
  status: SubscriptionStatus;
  current_period_start: string;
  current_period_end: string;
  canceled_at: string | null;
  ended_at: string | null;
  stripe_customer_id: string;
  stripe_subscription_id: string;
  updated_at: string;
  users: { email: string } | null;
};

type SubscriptionsResponse = {
  summary: Record<string, number>;
  subscriptions: SubscriptionRow[];
  error?: string;
};

const statusOptions: Array<SubscriptionStatus | "all"> = [
  "all",
  "active",
  "trialing",
  "past_due",
  "canceled",
  "unpaid",
  "incomplete",
  "incomplete_expired",
  "paused",
];

async function getAdminSubscriptions(status: SubscriptionStatus | "all"): Promise<SubscriptionsResponse> {
  const query = status === "all" ? "" : `?status=${status}`;
  const response = await fetch(`/api/admin/subscriptions${query}`);
  const payload = (await response.json()) as SubscriptionsResponse;
  if (!response.ok) {
    throw new Error(payload.error ?? "Unable to fetch subscriptions.");
  }
  return payload;
}

function prettyDate(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export function SubscriptionManagementPanel() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<SubscriptionStatus | "all">("all");
  const [searchValue, setSearchValue] = useState("");

  const subscriptionsQuery = useQuery({
    queryKey: ["admin-subscriptions", statusFilter],
    queryFn: () => getAdminSubscriptions(statusFilter),
  });

  const syncMutation = useMutation({
    mutationFn: async (subscriptionId: string) => {
      const response = await fetch(`/api/admin/subscriptions/${subscriptionId}/sync`, {
        method: "POST",
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to sync subscription.");
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-subscriptions"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-analytics"] });
    },
  });

  const filteredRows = useMemo(() => {
    const rows = subscriptionsQuery.data?.subscriptions ?? [];
    const q = searchValue.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
      const email = row.users?.email?.toLowerCase() ?? "";
      return (
        email.includes(q) ||
        row.status.toLowerCase().includes(q) ||
        (row.plan_code ?? "").toLowerCase().includes(q) ||
        row.stripe_subscription_id.toLowerCase().includes(q)
      );
    });
  }, [searchValue, subscriptionsQuery.data?.subscriptions]);

  return (
    <AnimatedCard className="p-6">
      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Billing ops</p>
      <h2 className="mt-1 font-display text-2xl text-slate-950">Subscription Management</h2>
      <p className="mt-1 text-sm text-slate-600">Review lifecycle status and sync individual records from Stripe.</p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {statusOptions.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setStatusFilter(option)}
            className={`rounded-full border px-3 py-1 text-xs font-semibold shadow-sm ${
              statusFilter === option
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:text-slate-950"
            }`}
          >
            {option} {option !== "all" ? `(${subscriptionsQuery.data?.summary?.[option] ?? 0})` : ""}
          </button>
        ))}
      </div>

      <input
        value={searchValue}
        onChange={(event) => setSearchValue(event.target.value)}
        className="mt-4 w-full rounded-2xl border border-slate-300 bg-white px-3 py-3 text-sm shadow-sm outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-200"
        placeholder="Search by email, status, plan, or Stripe subscription id"
      />

      {subscriptionsQuery.isLoading ? <p className="mt-3 text-sm text-slate-600">Loading subscriptions...</p> : null}
      {subscriptionsQuery.error ? (
        <p className="mt-3 text-sm text-red-600">{(subscriptionsQuery.error as Error).message}</p>
      ) : null}
      {syncMutation.error ? <p className="mt-3 text-sm text-red-600">{(syncMutation.error as Error).message}</p> : null}

      <div className="mt-5 space-y-3">
        {filteredRows.map((row) => (
          <article key={row.id} className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 transition hover:border-slate-300 hover:bg-white">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-900">{row.users?.email ?? "Unknown user"}</p>
              <p className="text-xs font-semibold text-slate-700">{row.status}</p>
            </div>

            <div className="mt-1 grid gap-1 text-xs text-slate-600 sm:grid-cols-2">
              <p>Plan: {row.plan_code ?? "not-set"}</p>
              <p>Period End: {prettyDate(row.current_period_end)}</p>
              <p>Stripe Sub: {row.stripe_subscription_id}</p>
              <p>Updated: {prettyDate(row.updated_at)}</p>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => syncMutation.mutate(row.id)}
                disabled={syncMutation.isPending}
                className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:border-slate-400 hover:text-slate-950"
              >
                {syncMutation.isPending ? "Syncing..." : "Sync from Stripe"}
              </button>
            </div>
          </article>
        ))}

        {!filteredRows.length ? <p className="text-sm text-slate-600">No subscriptions in this view.</p> : null}
      </div>
    </AnimatedCard>
  );
}
