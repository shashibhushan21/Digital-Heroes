import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit/logs";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const bodySchema = z.object({
  decision: z.enum(["approved", "rejected"]),
  reviewNotes: z.string().max(1000).optional(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ verificationId: string }> },
) {
  const user = await requireAdmin();

  const { verificationId } = await context.params;
  const payload = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid review payload." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();

  const { data: verification, error: verificationError } = await supabase
    .from("winner_verifications")
    .select("id,winner_id,submitted_by_user_id,status,review_notes,winners!inner(id,winning_amount_minor,currency)")
    .eq("id", verificationId)
    .single();

  if (verificationError || !verification) {
    return NextResponse.json({ error: "Verification record not found." }, { status: 404 });
  }

  const { error: updateError } = await supabase
    .from("winner_verifications")
    .update({
      status: parsed.data.decision,
      review_notes: parsed.data.reviewNotes ?? null,
      reviewed_by_user_id: user.id,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", verificationId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  if (parsed.data.decision === "approved") {
    const winner = verification.winners as unknown as { id: string; winning_amount_minor: number; currency: string };
    await supabase.from("payouts").upsert(
      {
        winner_id: winner.id,
        status: "pending",
        amount_minor: winner.winning_amount_minor,
        currency: winner.currency,
        idempotency_key: `winner-${winner.id}`,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "winner_id" },
    );
  }

  await writeAuditLog({
    actorUserId: user.id,
    entityType: "winner_verifications",
    entityId: verificationId,
    action: `admin.review.${parsed.data.decision}`,
    oldValues: {
      status: verification.status,
      review_notes: verification.review_notes,
    },
    newValues: {
      status: parsed.data.decision,
      review_notes: parsed.data.reviewNotes ?? null,
      reviewed_by_user_id: user.id,
      payout_created: parsed.data.decision === "approved",
    },
  });

  await supabase.from("notifications").insert({
    user_id: verification.submitted_by_user_id,
    channel: "email",
    event_type: `winner.verification.${parsed.data.decision}`,
    template_code:
      parsed.data.decision === "approved" ? "winner_verification_approved" : "winner_verification_rejected",
    payload_json: { verificationId, decision: parsed.data.decision },
    delivery_status: "queued",
  });

  return NextResponse.json({ success: true });
}
