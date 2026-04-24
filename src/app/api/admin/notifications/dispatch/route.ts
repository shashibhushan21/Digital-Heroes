import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit/logs";
import { dispatchQueuedNotifications } from "@/lib/notifications/dispatch";

export async function POST() {
  const user = await requireAdmin();

  try {
    const result = await dispatchQueuedNotifications();

    await writeAuditLog({
      actorUserId: user.id,
      entityType: "notifications_dispatch",
      entityId: user.id,
      action: "admin.dispatch_now",
      newValues: result,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to dispatch notifications." },
      { status: 500 },
    );
  }
}
