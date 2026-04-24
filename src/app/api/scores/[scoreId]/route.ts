import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser, hasActiveSubscription } from "@/lib/auth/session";
import { validateScoreValue } from "@/lib/domain/scoring";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const updateScoreSchema = z
  .object({
    scoreDate: z.iso.date().optional(),
    stablefordScore: z.number().int().optional(),
  })
  .refine((payload) => payload.scoreDate !== undefined || payload.stablefordScore !== undefined, {
    message: "At least one field must be provided.",
  });

type ScoreRow = {
  id: string;
  user_id: string;
  score_date: string;
  stableford_score: number;
};

export async function PATCH(request: NextRequest, context: { params: Promise<{ scoreId: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const hasAccess = await hasActiveSubscription(user.id);

  if (!hasAccess) {
    return NextResponse.json({ error: "Active subscription required." }, { status: 403 });
  }

  const { scoreId } = await context.params;
  const payload = await request.json().catch(() => null);
  const parsed = updateScoreSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid update payload." }, { status: 400 });
  }

  if (
    parsed.data.stablefordScore !== undefined &&
    !validateScoreValue(parsed.data.stablefordScore)
  ) {
    return NextResponse.json({ error: "Score must be between 1 and 45." }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();

  const { data: existing, error: existingError } = await supabase
    .from("scores")
    .select("id,user_id,score_date,stableford_score")
    .eq("id", scoreId)
    .eq("user_id", user.id)
    .single();

  if (existingError || !existing) {
    return NextResponse.json({ error: "Score record not found." }, { status: 404 });
  }

  if (parsed.data.scoreDate && parsed.data.scoreDate !== (existing as ScoreRow).score_date) {
    const { data: duplicateDate } = await supabase
      .from("scores")
      .select("id")
      .eq("user_id", user.id)
      .eq("score_date", parsed.data.scoreDate)
      .neq("id", scoreId)
      .maybeSingle();

    if (duplicateDate) {
      return NextResponse.json({ error: "A score for this date already exists." }, { status: 409 });
    }
  }

  const { data: updated, error: updateError } = await supabase
    .from("scores")
    .update({
      score_date: parsed.data.scoreDate,
      stableford_score: parsed.data.stablefordScore,
      updated_at: new Date().toISOString(),
    })
    .eq("id", scoreId)
    .eq("user_id", user.id)
    .select("id,score_date,stableford_score,created_at,updated_at")
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ score: updated });
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ scoreId: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const hasAccess = await hasActiveSubscription(user.id);

  if (!hasAccess) {
    return NextResponse.json({ error: "Active subscription required." }, { status: 403 });
  }

  const { scoreId } = await context.params;
  const supabase = await createServerSupabaseClient();

  const { error } = await supabase.from("scores").delete().eq("id", scoreId).eq("user_id", user.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
