"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { motion } from "framer-motion";
import { CalendarDays, PencilLine, Plus, Trash2 } from "lucide-react";
import { AnimatedCard } from "@/components/ui/animated-surface";

const scoreSchema = z.object({
  scoreDate: z.iso.date(),
  stablefordScore: z.number().int().min(1).max(45),
});

type ScoreFormValues = z.infer<typeof scoreSchema>;

type ApiScore = {
  id: string;
  scoreDate: string;
  stablefordScore: number;
  createdAt: string;
};

type ScoresResponse = {
  scores: ApiScore[];
  error?: string;
};

async function getScores(): Promise<ApiScore[]> {
  const response = await fetch("/api/scores");
  const payload = (await response.json()) as ScoresResponse;

  if (!response.ok) {
    throw new Error(payload.error ?? "Unable to fetch scores.");
  }

  return payload.scores;
}

export function ScoreManager() {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingDate, setEditingDate] = useState("");
  const [editingScore, setEditingScore] = useState("0");

  const createForm = useForm<ScoreFormValues>({
    resolver: zodResolver(scoreSchema),
    defaultValues: {
      scoreDate: new Date().toISOString().slice(0, 10),
      stablefordScore: 30,
    },
  });

  const scoresQuery = useQuery({
    queryKey: ["scores"],
    queryFn: getScores,
  });

  const createMutation = useMutation({
    mutationFn: async (values: ScoreFormValues) => {
      const response = await fetch("/api/scores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to add score.");
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["scores"] });
      createForm.reset({
        scoreDate: new Date().toISOString().slice(0, 10),
        stablefordScore: 30,
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (scoreId: string) => {
      const response = await fetch(`/api/scores/${scoreId}`, { method: "DELETE" });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to delete score.");
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["scores"] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ scoreId, scoreDate, stablefordScore }: { scoreId: string; scoreDate: string; stablefordScore: number }) => {
      const response = await fetch(`/api/scores/${scoreId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scoreDate, stablefordScore }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to update score.");
      }
    },
    onSuccess: async () => {
      setEditingId(null);
      await queryClient.invalidateQueries({ queryKey: ["scores"] });
    },
  });

  const statusMessage = useMemo(() => {
    if (createMutation.error) return (createMutation.error as Error).message;
    if (deleteMutation.error) return (deleteMutation.error as Error).message;
    if (updateMutation.error) return (updateMutation.error as Error).message;
    if (scoresQuery.error) return (scoresQuery.error as Error).message;
    return null;
  }, [createMutation.error, deleteMutation.error, scoresQuery.error, updateMutation.error]);

  return (
    <AnimatedCard className="p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Scoring</p>
          <h2 className="mt-1 font-display text-2xl text-slate-950">Score Manager</h2>
          <p className="mt-1 text-sm text-slate-600">Enter and maintain your latest five Stableford scores.</p>
        </div>
      </div>

      <form
        className="mt-6 grid gap-3 sm:grid-cols-[1fr_1fr_auto]"
        onSubmit={createForm.handleSubmit((values) => createMutation.mutate(values))}
      >
        <input
          type="date"
          className="rounded-2xl border border-slate-300 bg-white px-3 py-3 text-sm shadow-sm outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-200"
          {...createForm.register("scoreDate")}
        />
        <input
          type="number"
          min={1}
          max={45}
          className="rounded-2xl border border-slate-300 bg-white px-3 py-3 text-sm shadow-sm outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-200"
          {...createForm.register("stablefordScore", { valueAsNumber: true })}
        />
        <button
          type="submit"
          disabled={createMutation.isPending}
          className="inline-flex items-center justify-center rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_35px_-18px_rgba(16,32,58,0.75)] hover:bg-slate-800 disabled:opacity-70"
        >
          <Plus className="mr-2 h-4 w-4" />
          {createMutation.isPending ? "Saving..." : "Add score"}
        </button>
      </form>

      {statusMessage ? <p className="mt-3 text-sm text-red-600">{statusMessage}</p> : null}

      <div className="mt-6 space-y-3">
        {scoresQuery.isLoading ? <p className="text-sm text-slate-600">Loading scores...</p> : null}
        {!scoresQuery.isLoading && (scoresQuery.data?.length ?? 0) === 0 ? (
          <p className="text-sm text-slate-600">No scores yet. Add your first entry.</p>
        ) : null}

        {scoresQuery.data?.map((score) => {
          const isEditing = editingId === score.id;
          return (
            <motion.article
              key={score.id}
              whileHover={{ y: -2 }}
              transition={{ duration: 0.2 }}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white/70 px-4 py-3 shadow-sm transition hover:border-slate-300 hover:bg-white"
            >
              {isEditing ? (
                <div className="flex flex-1 flex-wrap items-center gap-2">
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
                    value={editingScore}
                    onChange={(event) => setEditingScore(event.target.value)}
                    className="w-24 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-200"
                  />
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-950 text-white">
                    <CalendarDays className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{score.stablefordScore} points</p>
                    <p className="text-xs text-slate-600">{score.scoreDate}</p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2">
                {isEditing ? (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        updateMutation.mutate({
                          scoreId: score.id,
                          scoreDate: editingDate,
                          stablefordScore: Number(editingScore),
                        })
                      }
                      className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white shadow-sm hover:bg-slate-800"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:border-slate-400 hover:text-slate-950"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(score.id);
                        setEditingDate(score.scoreDate);
                        setEditingScore(String(score.stablefordScore));
                      }}
                      className="inline-flex items-center rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:border-slate-400 hover:text-slate-950"
                    >
                      <PencilLine className="mr-1 h-3.5 w-3.5" />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteMutation.mutate(score.id)}
                      className="inline-flex items-center rounded-full border border-red-300 px-3 py-1 text-xs font-semibold text-red-600 hover:border-red-400 hover:bg-red-50"
                    >
                      <Trash2 className="mr-1 h-3.5 w-3.5" />
                      Delete
                    </button>
                  </>
                )}
              </div>
            </motion.article>
          );
        })}
      </div>
    </AnimatedCard>
  );
}
