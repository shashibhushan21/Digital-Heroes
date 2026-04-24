import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  await requireAdmin();

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("notifications")
    .select(
      "id,user_id,channel,event_type,template_code,payload_json,delivery_status,provider_message_id,error_message,created_at,sent_at,users:user_id(email)",
    )
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const summary = (data ?? []).reduce(
    (acc, row) => {
      const key = row.delivery_status as "queued" | "sent" | "failed" | "suppressed";
      if (acc[key] !== undefined) {
        acc[key] += 1;
      }
      return acc;
    },
    {
      queued: 0,
      sent: 0,
      failed: 0,
      suppressed: 0,
    },
  );

  return NextResponse.json({
    summary,
    notifications: data ?? [],
  });
}
