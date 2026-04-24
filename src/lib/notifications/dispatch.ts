import { Resend } from "resend";
import { serverEnv } from "@/lib/config/env";
import { buildNotificationTemplate } from "@/lib/notifications/templates";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const DEFAULT_BATCH_SIZE = 50;

export type DispatchSummary = {
  queued: number;
  sent: number;
  failed: number;
};

export async function dispatchQueuedNotifications(limit = DEFAULT_BATCH_SIZE): Promise<DispatchSummary> {
  if (!serverEnv.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not configured.");
  }

  const resend = new Resend(serverEnv.RESEND_API_KEY);
  const supabase = createSupabaseAdminClient();

  const { data: queuedRows, error: queueError } = await supabase
    .from("notifications")
    .select("id,user_id,event_type,payload_json,users:user_id(email)")
    .eq("delivery_status", "queued")
    .order("created_at", { ascending: true })
    .limit(limit);

  if (queueError) {
    throw new Error(queueError.message);
  }

  const rows = queuedRows ?? [];
  let sentCount = 0;
  let failedCount = 0;

  for (const row of rows) {
    const recipient = (row.users as unknown as { email?: string } | null)?.email;
    if (!recipient || !row.user_id) {
      failedCount += 1;
      await supabase
        .from("notifications")
        .update({
          delivery_status: "failed",
          error_message: "Missing notification recipient email.",
        })
        .eq("id", row.id);
      continue;
    }

    const template = buildNotificationTemplate(
      row.event_type,
      (row.payload_json as Record<string, unknown> | null) ?? {},
    );

    const { data, error } = await resend.emails.send({
      from: serverEnv.NOTIFICATION_FROM_EMAIL ?? "onboarding@resend.dev",
      to: recipient,
      subject: template.subject,
      text: template.text,
    });

    if (error) {
      failedCount += 1;
      await supabase
        .from("notifications")
        .update({
          delivery_status: "failed",
          error_message: error.message,
        })
        .eq("id", row.id);
      continue;
    }

    sentCount += 1;
    await supabase
      .from("notifications")
      .update({
        delivery_status: "sent",
        sent_at: new Date().toISOString(),
        provider_message_id: data?.id ?? null,
        error_message: null,
      })
      .eq("id", row.id);
  }

  return {
    queued: rows.length,
    sent: sentCount,
    failed: failedCount,
  };
}
