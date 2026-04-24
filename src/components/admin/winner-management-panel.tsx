"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatedCard } from "@/components/ui/animated-surface";

type VerificationRecord = {
  id: string;
  status: string;
  proof_file_path: string;
  review_notes: string | null;
  winners: {
    id: string;
    tier: number;
    winning_amount_minor: number;
    currency: string;
  };
  users: {
    email: string;
  } | null;
};

type PayoutRecord = {
  id: string;
  winner_id: string;
  status: string;
  amount_minor: number;
  currency: string;
  payment_reference: string | null;
};

type AdminWinnersResponse = {
  verifications: VerificationRecord[];
  payouts: PayoutRecord[];
  error?: string;
};

async function getAdminWinners(): Promise<AdminWinnersResponse> {
  const response = await fetch("/api/admin/winners");
  const payload = (await response.json()) as AdminWinnersResponse;
  if (!response.ok) throw new Error(payload.error ?? "Unable to fetch winner management records.");
  return payload;
}

export function WinnerManagementPanel() {
  const queryClient = useQueryClient();
  const [paymentRefByPayoutId, setPaymentRefByPayoutId] = useState<Record<string, string>>({});

  const adminQuery = useQuery({ queryKey: ["admin-winners"], queryFn: getAdminWinners });

  const reviewMutation = useMutation({
    mutationFn: async ({ verificationId, decision }: { verificationId: string; decision: "approved" | "rejected" }) => {
      const response = await fetch(`/api/admin/winners/${verificationId}/review`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Unable to review verification.");
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-winners"] });
    },
  });

  const markPaidMutation = useMutation({
    mutationFn: async ({ payoutId, paymentReference }: { payoutId: string; paymentReference: string }) => {
      const response = await fetch(`/api/admin/payouts/${payoutId}/mark-paid`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentReference }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Unable to mark payout paid.");
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-winners"] });
    },
  });

  return (
    <AnimatedCard className="p-6">
      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Winners</p>
      <h2 className="mt-1 font-display text-2xl text-slate-950">Winner Management</h2>
      <p className="mt-1 text-sm text-slate-600">Review winner proofs and mark verified payouts as paid.</p>

      {adminQuery.isLoading ? <p className="mt-3 text-sm text-slate-600">Loading winner queue...</p> : null}
      {adminQuery.error ? <p className="mt-3 text-sm text-red-600">{(adminQuery.error as Error).message}</p> : null}

      <div className="mt-5 space-y-4">
        <h3 className="text-sm font-semibold text-slate-900">Verification Queue</h3>
        {(adminQuery.data?.verifications ?? []).map((record) => (
          <article key={record.id} className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 transition hover:border-slate-300 hover:bg-white">
            <p className="text-sm font-semibold text-slate-900">
              {record.users?.email ?? "Unknown user"} · Tier {record.winners.tier} · {record.winners.winning_amount_minor} {record.winners.currency}
            </p>
            <p className="mt-1 text-xs text-slate-600">Status: {record.status}</p>
            <p className="mt-1 text-xs text-slate-600">Proof path: {record.proof_file_path}</p>

            {record.status === "pending" ? (
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => reviewMutation.mutate({ verificationId: record.id, decision: "approved" })}
                  className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white shadow-sm hover:bg-slate-800"
                >
                  Approve
                </button>
                <button
                  type="button"
                  onClick={() => reviewMutation.mutate({ verificationId: record.id, decision: "rejected" })}
                  className="rounded-full border border-red-300 bg-white px-3 py-1 text-xs font-semibold text-red-600 shadow-sm hover:border-red-400 hover:bg-red-50"
                >
                  Reject
                </button>
              </div>
            ) : null}
          </article>
        ))}

        <h3 className="pt-2 text-sm font-semibold text-slate-900">Payouts</h3>
        {(adminQuery.data?.payouts ?? []).map((payout) => (
          <article key={payout.id} className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 transition hover:border-slate-300 hover:bg-white">
            <p className="text-sm font-semibold text-slate-900">
              Winner {payout.winner_id.slice(0, 8)} · {payout.amount_minor} {payout.currency}
            </p>
            <p className="mt-1 text-xs text-slate-600">Status: {payout.status}</p>

            {payout.status === "pending" ? (
              <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
                <input
                  value={paymentRefByPayoutId[payout.id] ?? ""}
                  onChange={(event) =>
                    setPaymentRefByPayoutId((current) => ({
                      ...current,
                      [payout.id]: event.target.value,
                    }))
                  }
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-200"
                  placeholder="Payment reference"
                />
                <button
                  type="button"
                  onClick={() =>
                    markPaidMutation.mutate({
                      payoutId: payout.id,
                      paymentReference: paymentRefByPayoutId[payout.id] ?? "manual-ref",
                    })
                  }
                  className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-slate-800"
                >
                  Mark Paid
                </button>
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </AnimatedCard>
  );
}
