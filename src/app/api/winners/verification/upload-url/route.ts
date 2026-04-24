import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const WINNER_PROOFS_BUCKET = "winner-proofs";
const MAX_PROOF_FILE_SIZE_BYTES = 10 * 1024 * 1024;

const bodySchema = z.object({
  winnerId: z.string().uuid(),
  fileName: z.string().trim().min(3).max(200),
  fileType: z.string().trim().min(3).max(100),
  fileSize: z.number().int().positive().max(MAX_PROOF_FILE_SIZE_BYTES),
});

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-").slice(-120);
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid upload payload." }, { status: 400 });
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

  const safeName = sanitizeFileName(parsed.data.fileName);
  const objectPath = `${user.id}/${parsed.data.winnerId}/${Date.now()}-${safeName}`;

  const { data, error } = await supabase.storage
    .from(WINNER_PROOFS_BUCKET)
    .createSignedUploadUrl(objectPath, { upsert: false });

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Unable to create signed upload URL." }, { status: 500 });
  }

  return NextResponse.json({
    upload: {
      bucket: WINNER_PROOFS_BUCKET,
      path: objectPath,
      token: data.token,
      fileType: parsed.data.fileType,
      maxBytes: MAX_PROOF_FILE_SIZE_BYTES,
    },
  });
}
