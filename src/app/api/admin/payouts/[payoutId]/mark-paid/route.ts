import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit/logs";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const bodySchema = z.object({
  paymentReference: z.string().min(2).max(200),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ payoutId: string }> },
) {
  const user = await requireAdmin();

  const { payoutId } = await context.params;
  const payload = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payout payload." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();

  const { data: payout, error: payoutError } = await supabase
    .from("payouts")
    .select("id,status,winner_id,payment_reference,winners!inner(user_id)")
    .eq("id", payoutId)
    .single();

  if (payoutError || !payout) {
    return NextResponse.json({ error: "Payout record not found." }, { status: 404 });
  }

  if (payout.status === "paid") {
    return NextResponse.json({ error: "Payout already marked as paid." }, { status: 409 });
  }

  const { error: updateError } = await supabase
    .from("payouts")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      marked_paid_by_user_id: user.id,
      payment_reference: parsed.data.paymentReference,
      updated_at: new Date().toISOString(),
    })
    .eq("id", payoutId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  const winnerUserId = (payout.winners as unknown as { user_id: string }).user_id;

  await writeAuditLog({
    actorUserId: user.id,
    entityType: "payouts",
    entityId: payoutId,
    action: "admin.mark_paid",
    oldValues: {
      status: payout.status,
      payment_reference: payout.payment_reference,
    },
    newValues: {
      status: "paid",
      payment_reference: parsed.data.paymentReference,
      marked_paid_by_user_id: user.id,
    },
  });

  await supabase.from("notifications").insert({
    user_id: winnerUserId,
    channel: "email",
    event_type: "winner.payout.paid",
    template_code: "winner_payout_paid",
    payload_json: { payoutId, paymentReference: parsed.data.paymentReference },
    delivery_status: "queued",
  });

  return NextResponse.json({ success: true });
}
