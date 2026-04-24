import { writeAuditLog } from "@/lib/audit/logs";
import { serverEnv } from "@/lib/config/env";
import { buildUserEntriesFromScores, countMatches, generateDrawNumbers, type DrawMode } from "@/lib/domain/draw";
import { calculatePrizePools, splitTierAmount } from "@/lib/domain/prize";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type PublishSource = "admin" | "scheduler";

type ExistingDrawRow = {
  id: string;
  status: string;
};

type ActiveSubscriptionRow = {
  user_id: string;
};

type DrawEntryInsertRow = {
  id: string;
  user_id: string;
  match_count: number;
};

type PreviousPoolRow = {
  rollover_out_minor: number | null;
};

export type PublishOfficialDrawInput = {
  mode: DrawMode;
  drawYear: number;
  drawMonth: number;
  actorUserId: string | null;
  source: PublishSource;
};

export type PublishOfficialDrawSuccess = {
  drawId: string;
  drawYear: number;
  drawMonth: number;
  mode: DrawMode;
  drawNumbers: number[];
  participantCount: number;
  winners: {
    tier5: number;
    tier4: number;
    tier3: number;
  };
  rolloverOutMinor: number;
};

export type PublishOfficialDrawFailure = {
  status: number;
  error: string;
};

export async function publishOfficialDraw(
  input: PublishOfficialDrawInput,
): Promise<{ data: PublishOfficialDrawSuccess } | { error: PublishOfficialDrawFailure }> {
  try {
    const supabase = createSupabaseAdminClient();

    const { data: existingDraw, error: existingDrawError } = await supabase
      .from("draws")
      .select("id,status")
      .eq("draw_year", input.drawYear)
      .eq("draw_month", input.drawMonth)
      .maybeSingle();

    if (existingDrawError) {
      return { error: { status: 500, error: existingDrawError.message } };
    }

    const typedExistingDraw = existingDraw as ExistingDrawRow | null;
    if (typedExistingDraw?.status === "published") {
      return { error: { status: 409, error: "Draw already published for this period." } };
    }

    const { data: activeSubscriptions, error: subscriptionsError } = await supabase
      .from("subscriptions")
      .select("user_id,current_period_end")
      .in("status", ["active", "trialing"])
      .gte("current_period_end", new Date().toISOString());

    if (subscriptionsError) {
      return { error: { status: 500, error: subscriptionsError.message } };
    }

    const userIds = Array.from(
      new Set(((activeSubscriptions ?? []) as ActiveSubscriptionRow[]).map((item) => item.user_id)),
    );

    if (userIds.length === 0) {
      return { error: { status: 400, error: "No active subscribers for draw publish." } };
    }

    const { data: scoreRows, error: scoresError } = await supabase
      .from("scores")
      .select("user_id,stableford_score,score_date,created_at")
      .in("user_id", userIds);

    if (scoresError) {
      return { error: { status: 500, error: scoresError.message } };
    }

    const entries = buildUserEntriesFromScores(scoreRows ?? []);
    if (entries.length === 0) {
      return { error: { status: 400, error: "No eligible users with 5 scores for draw publish." } };
    }

    const drawNumbers = generateDrawNumbers(input.mode, entries);

    const { data: draw, error: drawUpsertError } = await supabase
      .from("draws")
      .upsert(
        {
          draw_year: input.drawYear,
          draw_month: input.drawMonth,
          mode: input.mode,
          status: "published",
          published_at: new Date().toISOString(),
          published_by: input.actorUserId,
        },
        { onConflict: "draw_year,draw_month" },
      )
      .select("id")
      .single();

    if (drawUpsertError) {
      return { error: { status: 500, error: drawUpsertError.message } };
    }

    const cleanupResults = await Promise.all([
      supabase.from("draw_entries").delete().eq("draw_id", draw.id),
      supabase.from("winners").delete().eq("draw_id", draw.id),
      supabase.from("prize_pools").delete().eq("draw_id", draw.id),
      supabase.from("draw_runs").delete().eq("draw_id", draw.id).eq("run_type", "official"),
    ]);

    const cleanupError = cleanupResults.find((result) => result.error)?.error;
    if (cleanupError) {
      return { error: { status: 500, error: cleanupError.message } };
    }

    const entryRows = entries.map((entry) => ({
      draw_id: draw.id,
      user_id: entry.userId,
      entry_numbers: entry.numbers,
      match_count: countMatches(entry.numbers, drawNumbers),
      is_eligible: true,
    }));

    const { data: insertedEntries, error: entryInsertError } = await supabase
      .from("draw_entries")
      .insert(entryRows)
      .select("id,user_id,match_count");

    if (entryInsertError) {
      return { error: { status: 500, error: entryInsertError.message } };
    }

    const { error: drawRunError } = await supabase.from("draw_runs").insert({
      draw_id: draw.id,
      run_type: "official",
      run_version: 1,
      result_numbers: drawNumbers,
      participant_snapshot_count: entries.length,
      executed_by: input.actorUserId,
      is_published: true,
    });

    if (drawRunError) {
      return { error: { status: 500, error: drawRunError.message } };
    }

    const { data: previousPool, error: previousPoolError } = await supabase
      .from("prize_pools")
      .select("rollover_out_minor")
      .order("computed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (previousPoolError) {
      return { error: { status: 500, error: previousPoolError.message } };
    }

    const previousPoolRow = previousPool as PreviousPoolRow | null;
    const rolloverInMinor = previousPoolRow?.rollover_out_minor ?? 0;
    const poolPerActiveMinor = serverEnv.DRAW_POOL_PER_ACTIVE_MINOR ?? 1000;
    const grossPoolMinor = entries.length * poolPerActiveMinor;

    const prize = calculatePrizePools({
      grossPoolMinor,
      rolloverInMinor,
    });

    const typedInsertedEntries = (insertedEntries ?? []) as DrawEntryInsertRow[];
    const tier5Winners = typedInsertedEntries.filter((entry) => entry.match_count === 5);
    const tier4Winners = typedInsertedEntries.filter((entry) => entry.match_count === 4);
    const tier3Winners = typedInsertedEntries.filter((entry) => entry.match_count === 3);

    const rolloverOutMinor = tier5Winners.length === 0 ? prize.tier5Minor : 0;

    const { error: prizePoolError } = await supabase.from("prize_pools").insert({
      draw_id: draw.id,
      active_subscriber_count: entries.length,
      gross_pool_minor: grossPoolMinor,
      rollover_in_minor: rolloverInMinor,
      tier_5_minor: prize.tier5Minor,
      tier_4_minor: prize.tier4Minor,
      tier_3_minor: prize.tier3Minor,
      rollover_out_minor: rolloverOutMinor,
      currency: "USD",
    });

    if (prizePoolError) {
      return { error: { status: 500, error: prizePoolError.message } };
    }

    const winnerRows = [
      ...tier5Winners.map((entry) => ({
        draw_id: draw.id,
        user_id: entry.user_id,
        draw_entry_id: entry.id,
        tier: 5,
        winning_amount_minor: splitTierAmount(prize.tier5Minor, tier5Winners.length),
        currency: "USD",
      })),
      ...tier4Winners.map((entry) => ({
        draw_id: draw.id,
        user_id: entry.user_id,
        draw_entry_id: entry.id,
        tier: 4,
        winning_amount_minor: splitTierAmount(prize.tier4Minor, tier4Winners.length),
        currency: "USD",
      })),
      ...tier3Winners.map((entry) => ({
        draw_id: draw.id,
        user_id: entry.user_id,
        draw_entry_id: entry.id,
        tier: 3,
        winning_amount_minor: splitTierAmount(prize.tier3Minor, tier3Winners.length),
        currency: "USD",
      })),
    ];

    if (winnerRows.length > 0) {
      const { error: winnerInsertError } = await supabase.from("winners").insert(winnerRows);
      if (winnerInsertError) {
        return { error: { status: 500, error: winnerInsertError.message } };
      }
    }

    await writeAuditLog({
      actorUserId: input.actorUserId,
      entityType: "draws",
      entityId: draw.id,
      action: input.source === "scheduler" ? "cron.draw.publish" : "admin.draw.publish",
      oldValues: typedExistingDraw
        ? {
            status: typedExistingDraw.status,
          }
        : null,
      newValues: {
        source: input.source,
        draw_year: input.drawYear,
        draw_month: input.drawMonth,
        mode: input.mode,
        status: "published",
        participant_count: entries.length,
        draw_numbers: drawNumbers,
        winner_counts: {
          tier5: tier5Winners.length,
          tier4: tier4Winners.length,
          tier3: tier3Winners.length,
        },
        rollover_out_minor: rolloverOutMinor,
      },
    });

    return {
      data: {
        drawId: draw.id,
        drawYear: input.drawYear,
        drawMonth: input.drawMonth,
        mode: input.mode,
        drawNumbers,
        participantCount: entries.length,
        winners: {
          tier5: tier5Winners.length,
          tier4: tier4Winners.length,
          tier3: tier3Winners.length,
        },
        rolloverOutMinor,
      },
    };
  } catch (error) {
    return {
      error: {
        status: 500,
        error: error instanceof Error ? error.message : "Unexpected draw publish failure.",
      },
    };
  }
}
