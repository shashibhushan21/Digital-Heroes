import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  await requireAdmin();

  const supabase = createSupabaseAdminClient();

  const { data: verifications, error: verificationError } = await supabase
    .from("winner_verifications")
    .select(
      "id,winner_id,status,proof_file_path,review_notes,created_at,reviewed_at,winners(id,user_id,tier,winning_amount_minor,currency,draw_id),users:submitted_by_user_id(email)",
    )
    .order("created_at", { ascending: false });

  if (verificationError) {
    return NextResponse.json({ error: verificationError.message }, { status: 500 });
  }

  const { data: payouts, error: payoutError } = await supabase
    .from("payouts")
    .select("id,winner_id,status,amount_minor,currency,paid_at,payment_reference,created_at")
    .order("created_at", { ascending: false });

  if (payoutError) {
    return NextResponse.json({ error: payoutError.message }, { status: 500 });
  }

  return NextResponse.json({
    verifications: verifications ?? [],
    payouts: payouts ?? [],
  });
}
