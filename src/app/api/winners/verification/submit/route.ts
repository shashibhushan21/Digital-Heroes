import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const bodySchema = z.object({
  winnerId: z.string().uuid(),
  proofFilePath: z.string().min(3),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid verification payload." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data: winner, error: winnerError } = await supabase
    .from("winners")
    .select("id,user_id")
    .eq("id", parsed.data.winnerId)
    .maybeSingle();

  if (winnerError) {
    return NextResponse.json({ error: winnerError.message }, { status: 500 });
  }

  if (!winner || winner.user_id !== user.id) {
    return NextResponse.json({ error: "Winner record not found." }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("winner_verifications")
    .upsert(
      {
        winner_id: parsed.data.winnerId,
        submitted_by_user_id: user.id,
        proof_file_path: parsed.data.proofFilePath,
        status: "pending",
        review_notes: null,
        reviewed_by_user_id: null,
        reviewed_at: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "winner_id" },
    )
    .select("id,status,proof_file_path,created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await supabase.from("notifications").insert({
    user_id: user.id,
    channel: "email",
    event_type: "winner.verification.submitted",
    template_code: "winner_verification_submitted",
    payload_json: { winnerId: parsed.data.winnerId },
    delivery_status: "queued",
  });

  return NextResponse.json({ verification: data });
}
