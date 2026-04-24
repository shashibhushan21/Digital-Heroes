"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClientSupabaseClient } from "@/lib/supabase/client";
import { AnimatedCard } from "@/components/ui/animated-surface";

type WinnerRecord = {
  id: string;
  tier: number;
  winning_amount_minor: number;
  currency: string;
  winner_verifications?: Array<{
    id: string;
    status: string;
    proof_file_path: string;
    review_notes: string | null;
  }>;
  payouts?: Array<{
    id: string;
    status: string;
    amount_minor: number;
    paid_at: string | null;
  }>;
};

type WinnersResponse = {
  winners: WinnerRecord[];
  error?: string;
};

type SignedUploadResponse = {
  upload?: {
    bucket: string;
    path: string;
    token: string;
  };
  error?: string;
};

async function getMyWinners(): Promise<WinnerRecord[]> {
  const response = await fetch("/api/winners/me");
  const payload = (await response.json()) as WinnersResponse;
  if (!response.ok) throw new Error(payload.error ?? "Unable to fetch winner records.");
  return payload.winners;
}

export function WinnerVerificationCard() {
  const queryClient = useQueryClient();
  const [selectedFileByWinnerId, setSelectedFileByWinnerId] = useState<Record<string, File | null>>({});

  const winnersQuery = useQuery({
    queryKey: ["my-winners"],
    queryFn: getMyWinners,
  });

  const submitMutation = useMutation({
    mutationFn: async ({ winnerId, proofFilePath }: { winnerId: string; proofFilePath: string }) => {
      const response = await fetch("/api/winners/verification/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ winnerId, proofFilePath }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Failed to submit verification.");
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["my-winners"] });
    },
  });

  const uploadAndSubmitMutation = useMutation({
    mutationFn: async ({ winnerId, file, fallbackPath }: { winnerId: string; file: File | null; fallbackPath: string }) => {
      let proofFilePath = fallbackPath;

      if (file) {
        const signResponse = await fetch("/api/winners/verification/upload-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            winnerId,
            fileName: file.name,
            fileType: file.type || "application/octet-stream",
            fileSize: file.size,
          }),
        });

        const signPayload = (await signResponse.json()) as SignedUploadResponse;
        if (!signResponse.ok || !signPayload.upload) {
          throw new Error(signPayload.error ?? "Unable to prepare proof upload.");
        }

        const supabase = createClientSupabaseClient();
        const { error: uploadError } = await supabase.storage
          .from(signPayload.upload.bucket)
          .uploadToSignedUrl(signPayload.upload.path, signPayload.upload.token, file);

        if (uploadError) {
          throw new Error(uploadError.message);
        }

        proofFilePath = signPayload.upload.path;
      }

      if (!proofFilePath) {
        throw new Error("Please select a file before submitting proof.");
      }

      await submitMutation.mutateAsync({ winnerId, proofFilePath });
    },
    onSuccess: async (_, variables) => {
      setSelectedFileByWinnerId((current) => ({ ...current, [variables.winnerId]: null }));
      await queryClient.invalidateQueries({ queryKey: ["my-winners"] });
    },
  });

  return (
    <AnimatedCard className="p-6">
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Winnings</p>
        <h2 className="mt-1 font-display text-2xl text-slate-950">Winner Verification</h2>
        <p className="mt-1 text-sm text-slate-600">Upload your proof document and track verification and payout status.</p>
      </div>

      {winnersQuery.isLoading ? <p className="mt-3 text-sm text-slate-600">Loading winner records...</p> : null}
      {winnersQuery.error ? <p className="mt-3 text-sm text-red-600">{(winnersQuery.error as Error).message}</p> : null}

      <div className="mt-4 space-y-3">
        {winnersQuery.data?.length ? (
          winnersQuery.data.map((winner) => {
            const verification = winner.winner_verifications?.[0];
            const payout = winner.payouts?.[0];

            return (
              <article key={winner.id} className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 transition hover:border-slate-300 hover:bg-white">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">
                    Tier {winner.tier} winner · {winner.winning_amount_minor} {winner.currency}
                  </p>
                  <p className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm">Verification: {verification?.status ?? "not submitted"}</p>
                </div>
                <p className="mt-1 text-xs text-slate-600">Payout: {payout?.status ?? "pending review"}</p>

                <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(event) => {
                      const file = event.target.files?.[0] ?? null;
                      setSelectedFileByWinnerId((current) => ({
                        ...current,
                        [winner.id]: file,
                      }));
                    }}
                    className="rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-200"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      uploadAndSubmitMutation.mutate({
                        winnerId: winner.id,
                        file: selectedFileByWinnerId[winner.id] ?? null,
                        fallbackPath: verification?.proof_file_path ?? "",
                      })
                    }
                    className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-[0_14px_28px_-16px_rgba(16,32,58,0.8)] hover:bg-slate-800"
                  >
                    Submit Proof
                  </button>
                </div>

                {selectedFileByWinnerId[winner.id] ? (
                  <p className="mt-2 text-xs text-slate-600">Selected: {selectedFileByWinnerId[winner.id]?.name}</p>
                ) : null}

                {verification?.proof_file_path ? (
                  <p className="mt-2 text-xs text-slate-600">Last submitted file: {verification.proof_file_path}</p>
                ) : null}

                {verification?.review_notes ? (
                  <p className="mt-2 text-xs text-slate-600">Review notes: {verification.review_notes}</p>
                ) : null}
              </article>
            );
          })
        ) : (
          <p className="text-sm text-slate-600">No winner records yet.</p>
        )}
      </div>
    </AnimatedCard>
  );
}
