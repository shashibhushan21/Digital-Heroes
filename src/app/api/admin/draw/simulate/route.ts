import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/session";
import { buildUserEntriesFromScores, computeTierCounts, countMatches, generateDrawNumbers, type DrawMode } from "@/lib/domain/draw";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const bodySchema = z.object({
  mode: z.enum(["random", "weighted"]).default("random"),
  drawYear: z.number().int().optional(),
  drawMonth: z.number().int().min(1).max(12).optional(),
});

export async function POST(request: Request) {
  const user = await requireAdmin();

  const payload = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid simulate payload." }, { status: 400 });
  }

  const now = new Date();
  const drawYear = parsed.data.drawYear ?? now.getUTCFullYear();
  const drawMonth = parsed.data.drawMonth ?? now.getUTCMonth() + 1;
  const mode = parsed.data.mode as DrawMode;

  const supabase = createSupabaseAdminClient();

  const { data: drawRow } = await supabase
    .from("draws")
    .select("id,status")
    .eq("draw_year", drawYear)
    .eq("draw_month", drawMonth)
    .maybeSingle();

  if (drawRow?.status === "published") {
    return NextResponse.json({ error: "Draw already published for this period." }, { status: 409 });
  }

  const { data: activeSubscriptions, error: subError } = await supabase
    .from("subscriptions")
    .select("user_id,current_period_end")
    .in("status", ["active", "trialing"])
    .gte("current_period_end", new Date().toISOString());

  if (subError) {
    return NextResponse.json({ error: subError.message }, { status: 500 });
  }

  const userIds = Array.from(new Set((activeSubscriptions ?? []).map((item) => item.user_id)));
  if (userIds.length === 0) {
    return NextResponse.json({ error: "No active subscribers available for simulation." }, { status: 400 });
  }

  const { data: scoreRows, error: scoreError } = await supabase
    .from("scores")
    .select("user_id,stableford_score,score_date,created_at")
    .in("user_id", userIds);

  if (scoreError) {
    return NextResponse.json({ error: scoreError.message }, { status: 500 });
  }

  const entries = buildUserEntriesFromScores(scoreRows ?? []);
  if (entries.length === 0) {
    return NextResponse.json({ error: "No eligible users with 5 scores for simulation." }, { status: 400 });
  }

  const drawNumbers = generateDrawNumbers(mode, entries);
  const matchCounts = entries.map((entry) => countMatches(entry.numbers, drawNumbers));
  const tierCounts = computeTierCounts(matchCounts);

  const { data: draw, error: drawUpsertError } = await supabase
    .from("draws")
    .upsert(
      {
        draw_year: drawYear,
        draw_month: drawMonth,
        mode,
        status: "simulated",
      },
      { onConflict: "draw_year,draw_month" },
    )
    .select("id")
    .single();

  if (drawUpsertError) {
    return NextResponse.json({ error: drawUpsertError.message }, { status: 500 });
  }

  const { count: runCount } = await supabase
    .from("draw_runs")
    .select("id", { count: "exact", head: true })
    .eq("draw_id", draw.id)
    .eq("run_type", "simulation");

  const { error: runError } = await supabase.from("draw_runs").insert({
    draw_id: draw.id,
    run_type: "simulation",
    run_version: (runCount ?? 0) + 1,
    result_numbers: drawNumbers,
    participant_snapshot_count: entries.length,
    executed_by: user.id,
    is_published: false,
  });

  if (runError) {
    return NextResponse.json({ error: runError.message }, { status: 500 });
  }

  return NextResponse.json({
    drawId: draw.id,
    drawYear,
    drawMonth,
    mode,
    drawNumbers,
    participantCount: entries.length,
    tierCounts,
  });
}
