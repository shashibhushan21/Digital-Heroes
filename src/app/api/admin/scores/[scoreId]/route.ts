import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/session";
import { SCORE_RULES } from "@/lib/constants/business-rules";
import { writeAuditLog } from "@/lib/audit/logs";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const updateSchema = z
  .object({
    scoreDate: z.iso.date().optional(),
    stablefordScore: z.number().int().min(SCORE_RULES.min).max(SCORE_RULES.max).optional(),
  })
  .refine((payload) => payload.scoreDate !== undefined || payload.stablefordScore !== undefined, {
    message: "At least one field is required.",
  });

type Context = {
  params: Promise<{ scoreId: string }>;
};

export async function PATCH(request: NextRequest, context: Context) {
  const actor = await requireAdmin();

  const payload = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid score update payload." }, { status: 400 });
  }

  const { scoreId } = await context.params;
  const supabase = createSupabaseAdminClient();

  const { data: existing, error: existingError } = await supabase
    .from("scores")
    .select("id,user_id,score_date,stableford_score")
    .eq("id", scoreId)
    .maybeSingle();

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }

  if (!existing) {
    return NextResponse.json({ error: "Score not found." }, { status: 404 });
  }

  if (parsed.data.scoreDate && parsed.data.scoreDate !== existing.score_date) {
    const { data: duplicate } = await supabase
      .from("scores")
      .select("id")
      .eq("user_id", existing.user_id)
      .eq("score_date", parsed.data.scoreDate)
      .neq("id", scoreId)
      .maybeSingle();

    if (duplicate) {
      return NextResponse.json({ error: "Another score exists for this user/date." }, { status: 409 });
    }
  }

  const updatePayload = {
    score_date: parsed.data.scoreDate,
    stableford_score: parsed.data.stablefordScore,
    created_by_admin: true,
    updated_at: new Date().toISOString(),
  };

  const { data: updated, error: updateError } = await supabase
    .from("scores")
    .update(updatePayload)
    .eq("id", scoreId)
    .select("id,user_id,score_date,stableford_score,updated_at")
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  await writeAuditLog({
    actorUserId: actor.id,
    entityType: "scores",
    entityId: scoreId,
    action: "admin.score.update",
    oldValues: {
      score_date: existing.score_date,
      stableford_score: existing.stableford_score,
    },
    newValues: {
      score_date: updated.score_date,
      stableford_score: updated.stableford_score,
    },
  });

  return NextResponse.json({ score: updated });
}

export async function DELETE(_request: NextRequest, context: Context) {
  const actor = await requireAdmin();

  const { scoreId } = await context.params;
  const supabase = createSupabaseAdminClient();

  const { data: existing, error: existingError } = await supabase
    .from("scores")
    .select("id,score_date,stableford_score")
    .eq("id", scoreId)
    .maybeSingle();

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }

  if (!existing) {
    return NextResponse.json({ error: "Score not found." }, { status: 404 });
  }

  const { error: deleteError } = await supabase.from("scores").delete().eq("id", scoreId);
  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  await writeAuditLog({
    actorUserId: actor.id,
    entityType: "scores",
    entityId: scoreId,
    action: "admin.score.delete",
    oldValues: {
      score_date: existing.score_date,
      stableford_score: existing.stableford_score,
    },
    newValues: null,
  });

  return NextResponse.json({ ok: true });
}
