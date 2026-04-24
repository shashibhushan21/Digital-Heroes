import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type AuditLogInput = {
  actorUserId: string | null;
  entityType: string;
  entityId: string;
  action: string;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  requestId?: string | null;
};

export async function writeAuditLog(input: AuditLogInput): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("audit_logs").insert({
    actor_user_id: input.actorUserId,
    entity_type: input.entityType,
    entity_id: input.entityId,
    action: input.action,
    old_values_json: input.oldValues ?? null,
    new_values_json: input.newValues ?? null,
    request_id: input.requestId ?? null,
  });

  if (error) {
    console.warn("Audit log write failed:", error.message);
  }
}
