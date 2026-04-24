import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();

  const [
    entriesResult,
    publishedDrawsResult,
    winnersResult,
    payoutsResult,
  ] = await Promise.all([
    supabase
      .from("draw_entries")
      .select("id,draw_id,match_count,created_at,draws(draw_year,draw_month,status)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("draws")
      .select("id,draw_year,draw_month,status")
      .eq("status", "published")
      .order("draw_year", { ascending: false })
      .order("draw_month", { ascending: false }),
    supabase
      .from("winners")
      .select("id,tier,winning_amount_minor,currency,draw_id")
      .eq("user_id", user.id),
    supabase
      .from("payouts")
      .select("id,status,amount_minor,currency,winner_id,paid_at")
      .order("created_at", { ascending: false }),
  ]);

  const errors = [entriesResult.error, publishedDrawsResult.error, winnersResult.error, payoutsResult.error].filter(Boolean);
  if (errors.length > 0) {
    return NextResponse.json({ error: errors[0]?.message ?? "Unable to fetch participation summary." }, { status: 500 });
  }

  const entries = entriesResult.data ?? [];
  const publishedDraws = publishedDrawsResult.data ?? [];
  const winners = winnersResult.data ?? [];
  const allPayouts = payoutsResult.data ?? [];

  const winnerIds = new Set(winners.map((winner) => winner.id));
  const payouts = allPayouts.filter((payout) => winnerIds.has(payout.winner_id));

  const totalParticipations = entries.length;
  const totalPublishedDraws = publishedDraws.length;
  const winCount = winners.length;
  const bestMatch = entries.reduce((max, row) => Math.max(max, row.match_count ?? 0), 0);
  const totalWinningsMinor = winners.reduce((sum, row) => sum + (row.winning_amount_minor ?? 0), 0);
  const totalPaidMinor = payouts
    .filter((row) => row.status === "paid")
    .reduce((sum, row) => sum + (row.amount_minor ?? 0), 0);

  const recentEntries = entries.slice(0, 6).map((row) => {
    const draw = Array.isArray(row.draws) ? row.draws[0] : row.draws;
    return {
      id: row.id,
      drawId: row.draw_id,
      drawYear: draw?.draw_year ?? null,
      drawMonth: draw?.draw_month ?? null,
      drawStatus: draw?.status ?? null,
      matchCount: row.match_count,
      createdAt: row.created_at,
    };
  });

  return NextResponse.json({
    summary: {
      totalParticipations,
      totalPublishedDraws,
      participationRate:
        totalPublishedDraws > 0 ? Number(((totalParticipations / totalPublishedDraws) * 100).toFixed(1)) : 0,
      winCount,
      bestMatch,
      totalWinningsMinor,
      totalPaidMinor,
      pendingPayoutCount: payouts.filter((row) => row.status !== "paid").length,
    },
    recentEntries,
  });
}
