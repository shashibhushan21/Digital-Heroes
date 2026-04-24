import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/session";
import { type DrawMode } from "@/lib/domain/draw";
import { publishOfficialDraw } from "@/lib/domain/draw-publish";

const bodySchema = z.object({
  mode: z.enum(["random", "weighted"]).default("random"),
  drawYear: z.number().int().optional(),
  drawMonth: z.number().int().min(1).max(12).optional(),
});

export async function POST(request: Request) {
  const user = await requireAdmin();

  const payload = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid publish payload." }, { status: 400 });
  }

  const now = new Date();
  const drawYear = parsed.data.drawYear ?? now.getUTCFullYear();
  const drawMonth = parsed.data.drawMonth ?? now.getUTCMonth() + 1;
  const mode = parsed.data.mode as DrawMode;

  const result = await publishOfficialDraw({
    mode,
    drawYear,
    drawMonth,
    actorUserId: user.id,
    source: "admin",
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error.error }, { status: result.error.status });
  }

  return NextResponse.json(result.data);
}
