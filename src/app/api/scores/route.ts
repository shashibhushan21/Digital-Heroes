import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser, hasActiveSubscription } from "@/lib/auth/session";
import { canInsertScoreForDate, retainLatestScores, validateScoreValue } from "@/lib/domain/scoring";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const createScoreSchema = z.object({
  scoreDate: z.iso.date(),
  stablefordScore: z.number().int(),
});

type ScoreRow = {
  id: string;
  score_date: string;
  stableford_score: number;
  created_at: string;
};

function toApiScore(row: ScoreRow) {
  return {
    id: row.id,
    scoreDate: row.score_date,
    stablefordScore: row.stableford_score,
    createdAt: row.created_at,
  };
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from("scores")
    .select("id,score_date,stableford_score,created_at")
    .eq("user_id", user.id)
    .order("score_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ scores: (data ?? []).map((row) => toApiScore(row as ScoreRow)) });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const hasAccess = await hasActiveSubscription(user.id);

  if (!hasAccess) {
    return NextResponse.json({ error: "Active subscription required." }, { status: 403 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = createScoreSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid score payload." }, { status: 400 });
  }

  if (!validateScoreValue(parsed.data.stablefordScore)) {
    return NextResponse.json({ error: "Score must be between 1 and 45." }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();

  const { data: existingRows, error: listError } = await supabase
    .from("scores")
    .select("id,score_date,stableford_score,created_at")
    .eq("user_id", user.id);

  if (listError) {
    return NextResponse.json({ error: listError.message }, { status: 500 });
  }

  const existingScores = (existingRows ?? []).map((row) => ({
    scoreDate: (row as ScoreRow).score_date,
    stablefordScore: (row as ScoreRow).stableford_score,
    createdAt: (row as ScoreRow).created_at,
  }));

  if (!canInsertScoreForDate(existingScores, parsed.data.scoreDate)) {
    return NextResponse.json({ error: "A score for this date already exists." }, { status: 409 });
  }

  const { data: inserted, error: insertError } = await supabase
    .from("scores")
    .insert({
      user_id: user.id,
      score_date: parsed.data.scoreDate,
      stableford_score: parsed.data.stablefordScore,
    })
    .select("id,score_date,stableford_score,created_at")
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  const recomputeSource = [...existingScores, {
    scoreDate: inserted.score_date,
    stablefordScore: inserted.stableford_score,
    createdAt: inserted.created_at,
  }];

  const retained = retainLatestScores(recomputeSource);
  const retainedDates = new Set(retained.map((score) => score.scoreDate));
  const rowsToDelete = (existingRows ?? []).filter(
    (row) => !retainedDates.has((row as ScoreRow).score_date),
  ) as ScoreRow[];

  if (!retainedDates.has(inserted.score_date)) {
    rowsToDelete.push(inserted as ScoreRow);
  }

  if (rowsToDelete.length > 0) {
    const deleteIds = rowsToDelete.map((row) => row.id);
    await supabase.from("scores").delete().in("id", deleteIds);
  }

  const { data: finalRows, error: finalError } = await supabase
    .from("scores")
    .select("id,score_date,stableford_score,created_at")
    .eq("user_id", user.id)
    .order("score_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (finalError) {
    return NextResponse.json({ error: finalError.message }, { status: 500 });
  }

  return NextResponse.json({ scores: (finalRows ?? []).map((row) => toApiScore(row as ScoreRow)) });
}
