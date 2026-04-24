import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const CHARITY_MEDIA_BUCKET = "charity-media";
const MAX_IMAGE_FILE_SIZE_BYTES = 10 * 1024 * 1024;

const bodySchema = z.object({
  purpose: z.enum(["media", "event"]),
  fileName: z.string().trim().min(3).max(200),
  fileType: z.string().trim().min(3).max(100),
  fileSize: z.number().int().positive().max(MAX_IMAGE_FILE_SIZE_BYTES),
});

type Context = {
  params: Promise<{ charityId: string }>;
};

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-").slice(-120);
}

export async function POST(request: Request, context: Context) {
  await requireAdmin();

  const payload = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid upload payload." }, { status: 400 });
  }

  if (!parsed.data.fileType.toLowerCase().startsWith("image/")) {
    return NextResponse.json({ error: "Only image uploads are supported." }, { status: 400 });
  }

  const { charityId } = await context.params;
  const supabase = createSupabaseAdminClient();

  const { data: charity, error: charityError } = await supabase
    .from("charities")
    .select("id")
    .eq("id", charityId)
    .maybeSingle();

  if (charityError) {
    return NextResponse.json({ error: charityError.message }, { status: 500 });
  }

  if (!charity) {
    return NextResponse.json({ error: "Charity not found." }, { status: 404 });
  }

  const safeName = sanitizeFileName(parsed.data.fileName);
  const objectPath = `${charityId}/${parsed.data.purpose}/${Date.now()}-${safeName}`;

  const { data, error } = await supabase.storage
    .from(CHARITY_MEDIA_BUCKET)
    .createSignedUploadUrl(objectPath, { upsert: false });

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Unable to create signed upload URL." }, { status: 500 });
  }

  const { data: publicUrlData } = supabase.storage.from(CHARITY_MEDIA_BUCKET).getPublicUrl(objectPath);

  return NextResponse.json({
    upload: {
      bucket: CHARITY_MEDIA_BUCKET,
      path: objectPath,
      token: data.token,
      fileType: parsed.data.fileType,
      maxBytes: MAX_IMAGE_FILE_SIZE_BYTES,
    },
    publicUrl: publicUrlData.publicUrl,
  });
}
