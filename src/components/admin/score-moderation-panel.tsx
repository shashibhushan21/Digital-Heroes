"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatedCard } from "@/components/ui/animated-surface";

type ScoreRow = {
  id: string;
  user_id: string;
  score_date: string;
  stableford_score: number;
  created_at: string;
  updated_at: string;
  users: { email: string } | { email: string }[] | null;
};

async function getAdminScores(q: string): Promise<{ scores: ScoreRow[]; error?: string }> {
  const query = q.trim() ? `?q=${encodeURIComponent(q.trim())}` : "";
  const response = await fetch(`/api/admin/scores${query}`);
  const payload = (await response.json()) as { scores: ScoreRow[]; error?: string };
  if (!response.ok) {
    throw new Error(payload.error ?? "Unable to fetch scores.");
  }
  return payload;
}

function resolveEmail(row: ScoreRow): string {
  if (!row.users) return "Unknown user";
  if (Array.isArray(row.users)) return row.users[0]?.email ?? "Unknown user";
  return row.users.email ?? "Unknown user";
}

function prettyDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export function ScoreModerationPanel() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [editingScoreId, setEditingScoreId] = useState<string | null>(null);
  const [editingDate, setEditingDate] = useState("");
  const [editingValue, setEditingValue] = useState("0");

  const scoresQuery = useQuery({
    queryKey: ["admin-scores", search],
    queryFn: () => getAdminScores(search),
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: { scoreId: string; scoreDate: string; stablefordScore: number }) => {
      const response = await fetch(`/api/admin/scores/${payload.scoreId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scoreDate: payload.scoreDate,
          stablefordScore: payload.stablefordScore,
        }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(body.error ?? "Unable to update score.");
      }
    },
    onSuccess: async () => {
      setEditingScoreId(null);
      await queryClient.invalidateQueries({ queryKey: ["admin-scores"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (scoreId: string) => {
      const response = await fetch(`/api/admin/scores/${scoreId}`, { method: "DELETE" });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(body.error ?? "Unable to delete score.");
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-scores"] });
    },
  });

  const rows = useMemo(() => scoresQuery.data?.scores ?? [], [scoresQuery.data?.scores]);

  return (
    <AnimatedCard className="p-6">
      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Moderation</p>
      <h2 className="mt-1 font-display text-2xl text-slate-950">Score Moderation</h2>
      <p className="mt-1 text-sm text-slate-600">Review, edit, and remove user scores with audit logging.</p>

      <input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        className="mt-4 w-full rounded-2xl border border-slate-300 bg-white px-3 py-3 text-sm shadow-sm outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-200"
        placeholder="Search by user email, score date, or value"
      />

      {scoresQuery.isLoading ? <p className="mt-3 text-sm text-slate-600">Loading scores...</p> : null}
      {scoresQuery.error ? <p className="mt-3 text-sm text-red-600">{(scoresQuery.error as Error).message}</p> : null}
      {updateMutation.error ? <p className="mt-3 text-sm text-red-600">{(updateMutation.error as Error).message}</p> : null}
      {deleteMutation.error ? <p className="mt-3 text-sm text-red-600">{(deleteMutation.error as Error).message}</p> : null}

      <div className="mt-5 space-y-3">
        {rows.map((row) => {
          const isEditing = editingScoreId === row.id;
          return (
            <article key={row.id} className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 transition hover:border-slate-300 hover:bg-white">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900">{resolveEmail(row)}</p>
                <p className="text-xs text-slate-600">Updated: {prettyDate(row.updated_at)}</p>
              </div>

              {isEditing ? (
                <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_120px_auto_auto]">
                  <input
                    type="date"
                    value={editingDate}
                    onChange={(event) => setEditingDate(event.target.value)}
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-200"
                  />
                  <input
                    type="number"
                    min={1}
                    max={45}
                    value={editingValue}
                    onChange={(event) => setEditingValue(event.target.value)}
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-200"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      updateMutation.mutate({
                        scoreId: row.id,
                        scoreDate: editingDate,
                        stablefordScore: Number(editingValue),
                      })
                    }
                    className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-slate-800"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingScoreId(null)}
                    className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:border-slate-400 hover:text-slate-950"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="mt-2 grid gap-1 text-xs text-slate-600 sm:grid-cols-2">
                  <p>Date: {row.score_date}</p>
                  <p>Score: {row.stableford_score}</p>
                </div>
              )}

              {!isEditing ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingScoreId(row.id);
                      setEditingDate(row.score_date);
                      setEditingValue(String(row.stableford_score));
                    }}
                    className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:border-slate-400 hover:text-slate-950"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteMutation.mutate(row.id)}
                    className="rounded-full border border-red-300 bg-white px-3 py-1 text-xs font-semibold text-red-700 shadow-sm hover:border-red-400 hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>
              ) : null}
            </article>
          );
        })}

        {!rows.length ? <p className="text-sm text-slate-600">No scores in this view.</p> : null}
      </div>
    </AnimatedCard>
  );
}
