import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  await requireAdmin();

  const search = request.nextUrl.searchParams.get("q")?.trim().toLowerCase() ?? "";
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("scores")
    .select("id,user_id,score_date,stableford_score,created_at,updated_at,users(email)")
    .order("score_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(300);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []).filter((row) => {
    if (!search) return true;
    const usersRelation = row.users as { email?: string } | { email?: string }[] | null;
    const email = Array.isArray(usersRelation)
      ? (usersRelation[0]?.email ?? "")
      : (usersRelation?.email ?? "");
    return (
      email.toLowerCase().includes(search) ||
      String(row.score_date).includes(search) ||
      String(row.stableford_score).includes(search)
    );
  });

  return NextResponse.json({ scores: rows });
}
