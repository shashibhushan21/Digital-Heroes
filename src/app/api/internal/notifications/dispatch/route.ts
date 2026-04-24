import { NextResponse } from "next/server";
import { serverEnv } from "@/lib/config/env";
import { dispatchQueuedNotifications } from "@/lib/notifications/dispatch";

function isAuthorizedDispatchRequest(request: Request): boolean {
  const headerSecret = request.headers.get("x-dispatch-secret");
  if (serverEnv.NOTIFICATION_DISPATCH_SECRET && headerSecret === serverEnv.NOTIFICATION_DISPATCH_SECRET) {
    return true;
  }

  const authHeader = request.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (serverEnv.CRON_SECRET && bearerToken === serverEnv.CRON_SECRET) {
    return true;
  }

  if (!serverEnv.NOTIFICATION_DISPATCH_SECRET && !serverEnv.CRON_SECRET && serverEnv.NODE_ENV !== "production") {
    return true;
  }

  return false;
}

async function dispatchNotifications() {
  try {
    const result = await dispatchQueuedNotifications();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to dispatch notifications." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  if (!isAuthorizedDispatchRequest(request)) {
    return NextResponse.json({ error: "Unauthorized dispatch request." }, { status: 401 });
  }

  return dispatchNotifications();
}

export async function GET(request: Request) {
  if (!isAuthorizedDispatchRequest(request)) {
    return NextResponse.json({ error: "Unauthorized dispatch request." }, { status: 401 });
  }

  return dispatchNotifications();
}
