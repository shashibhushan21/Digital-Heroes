"use client";

import { useQuery } from "@tanstack/react-query";
import { ChartColumnBig, Coins, Trophy, Users } from "lucide-react";
import { AnimatedCard } from "@/components/ui/animated-surface";

type ParticipationResponse = {
  summary: {
    totalParticipations: number;
    totalPublishedDraws: number;
    participationRate: number;
    winCount: number;
    bestMatch: number;
    totalWinningsMinor: number;
    totalPaidMinor: number;
    pendingPayoutCount: number;
  };
  recentEntries: Array<{
    id: string;
    drawId: string;
    drawYear: number | null;
    drawMonth: number | null;
    drawStatus: string | null;
    matchCount: number;
    createdAt: string;
  }>;
  error?: string;
};

async function getParticipationSummary(): Promise<ParticipationResponse> {
  const response = await fetch("/api/draw/participation");
  const payload = (await response.json()) as ParticipationResponse;
  if (!response.ok) {
    throw new Error(payload.error ?? "Unable to fetch participation summary.");
  }
  return payload;
}

function formatMinor(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value / 100);
}

export function ParticipationSummaryCard() {
  const summaryQuery = useQuery({
    queryKey: ["draw-participation-summary"],
    queryFn: getParticipationSummary,
  });

  return (
    <AnimatedCard className="p-6">
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Participation</p>
        <h2 className="mt-1 font-display text-2xl text-slate-950">Participation Summary</h2>
        <p className="mt-1 text-sm text-slate-600">Track your draw participation history and winnings progress.</p>
      </div>

      {summaryQuery.isLoading ? <p className="mt-3 text-sm text-slate-600">Loading participation...</p> : null}
      {summaryQuery.error ? <p className="mt-3 text-sm text-red-600">{(summaryQuery.error as Error).message}</p> : null}

      {summaryQuery.data ? (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <article className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 transition hover:border-slate-300 hover:bg-white">
              <Users className="h-4 w-4 text-slate-500" />
              <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-500">Participations</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{summaryQuery.data.summary.totalParticipations}</p>
            </article>
            <article className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 transition hover:border-slate-300 hover:bg-white">
              <ChartColumnBig className="h-4 w-4 text-slate-500" />
              <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-500">Participation rate</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{summaryQuery.data.summary.participationRate}%</p>
            </article>
            <article className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 transition hover:border-slate-300 hover:bg-white">
              <Trophy className="h-4 w-4 text-slate-500" />
              <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-500">Wins</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{summaryQuery.data.summary.winCount}</p>
            </article>
            <article className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 transition hover:border-slate-300 hover:bg-white">
              <Coins className="h-4 w-4 text-slate-500" />
              <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-500">Best match</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{summaryQuery.data.summary.bestMatch}</p>
            </article>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <article className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 transition hover:border-emerald-300 hover:bg-emerald-100/60">
              <p className="text-xs uppercase tracking-[0.18em] text-emerald-700">Total winnings</p>
              <p className="mt-1 text-2xl font-semibold text-emerald-900">{formatMinor(summaryQuery.data.summary.totalWinningsMinor)}</p>
            </article>
            <article className="rounded-2xl border border-amber-200 bg-amber-50 p-4 transition hover:border-amber-300 hover:bg-amber-100/60">
              <p className="text-xs uppercase tracking-[0.18em] text-amber-700">Paid out / pending</p>
              <p className="mt-1 text-sm font-semibold text-amber-900">
                {formatMinor(summaryQuery.data.summary.totalPaidMinor)} paid · {summaryQuery.data.summary.pendingPayoutCount} pending
              </p>
            </article>
          </div>

          <div className="mt-6">
            <h3 className="text-sm font-semibold text-slate-900">Recent Draw Entries</h3>
            <div className="mt-3 space-y-2">
              {summaryQuery.data.recentEntries.map((entry) => (
                <article key={entry.id} className="rounded-2xl border border-slate-200/80 bg-white/75 p-3 text-sm text-slate-700 transition hover:border-slate-300 hover:bg-white">
                  Draw {entry.drawYear ?? "-"}-{entry.drawMonth ? String(entry.drawMonth).padStart(2, "0") : "-"} · Match {entry.matchCount}
                </article>
              ))}
              {!summaryQuery.data.recentEntries.length ? (
                <p className="text-sm text-slate-600">No draw entries yet.</p>
              ) : null}
            </div>
          </div>
        </>
      ) : null}
    </AnimatedCard>
  );
}
