import { NextResponse } from "next/server";
import { z } from "zod";
import { type DrawMode } from "@/lib/domain/draw";
import { publishOfficialDraw } from "@/lib/domain/draw-publish";
import { serverEnv } from "@/lib/config/env";

const bodySchema = z.object({
  mode: z.enum(["random", "weighted"]).optional(),
  drawYear: z.number().int().optional(),
  drawMonth: z.number().int().min(1).max(12).optional(),
});

const querySchema = z.object({
  mode: z.enum(["random", "weighted"]).optional(),
  drawYear: z.coerce.number().int().optional(),
  drawMonth: z.coerce.number().int().min(1).max(12).optional(),
});

function isAuthorizedDrawPublishRequest(request: Request): boolean {
  const authHeader = request.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (serverEnv.CRON_SECRET && bearerToken === serverEnv.CRON_SECRET) {
    return true;
  }

  if (!serverEnv.CRON_SECRET && serverEnv.NODE_ENV !== "production") {
    return true;
  }

  return false;
}

function resolveDefaultTarget() {
  const now = new Date();
  return {
    drawYear: now.getUTCFullYear(),
    drawMonth: now.getUTCMonth() + 1,
  };
}

async function executeScheduledPublish(input: {
  mode?: DrawMode;
  drawYear?: number;
  drawMonth?: number;
}) {
  const defaults = resolveDefaultTarget();
  const mode = input.mode ?? "random";
  const drawYear = input.drawYear ?? defaults.drawYear;
  const drawMonth = input.drawMonth ?? defaults.drawMonth;

  const result = await publishOfficialDraw({
    mode,
    drawYear,
    drawMonth,
    actorUserId: null,
    source: "scheduler",
  });

  if ("error" in result) {
    if (result.error.status === 400 || result.error.status === 409) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: result.error.error,
        drawYear,
        drawMonth,
        mode,
      });
    }

    return NextResponse.json({ error: result.error.error }, { status: result.error.status });
  }

  return NextResponse.json({
    ok: true,
    skipped: false,
    ...result.data,
  });
}

export async function GET(request: Request) {
  if (!isAuthorizedDrawPublishRequest(request)) {
    return NextResponse.json({ error: "Unauthorized draw publish request." }, { status: 401 });
  }

  const url = new URL(request.url);
  const payload = {
    mode: url.searchParams.get("mode") ?? undefined,
    drawYear: url.searchParams.get("drawYear") ?? undefined,
    drawMonth: url.searchParams.get("drawMonth") ?? undefined,
  };

  const parsed = querySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid draw publish query parameters." }, { status: 400 });
  }

  return executeScheduledPublish(parsed.data);
}

export async function POST(request: Request) {
  if (!isAuthorizedDrawPublishRequest(request)) {
    return NextResponse.json({ error: "Unauthorized draw publish request." }, { status: 401 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(payload ?? {});
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid draw publish payload." }, { status: 400 });
  }

  return executeScheduledPublish(parsed.data);
}
