import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const CHARITY_MEDIA_BUCKET = "charity-media";
const CHARITY_MEDIA_PUBLIC_PREFIX = `/storage/v1/object/public/${CHARITY_MEDIA_BUCKET}/`;

const mediaSchema = z.object({
  mediaUrl: z.url(),
  altText: z.string().max(200).default(""),
  caption: z.string().max(280).optional().or(z.literal("")),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
  isActive: z.boolean().default(true),
});

type Context = {
  params: Promise<{ charityId: string; mediaId: string }>;
};

function toCharityMediaObjectPath(mediaUrl: string | null | undefined): string | null {
  if (!mediaUrl) return null;

  try {
    const parsed = new URL(mediaUrl);
    const prefixIndex = parsed.pathname.indexOf(CHARITY_MEDIA_PUBLIC_PREFIX);
    if (prefixIndex < 0) return null;

    const encodedObjectPath = parsed.pathname.slice(prefixIndex + CHARITY_MEDIA_PUBLIC_PREFIX.length);
    if (!encodedObjectPath) return null;

    return decodeURIComponent(encodedObjectPath);
  } catch {
    return null;
  }
}

export async function PATCH(request: Request, context: Context) {
  await requireAdmin();

  const payload = await request.json().catch(() => null);
  const parsed = mediaSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid media update payload." }, { status: 400 });
  }

  const { charityId, mediaId } = await context.params;
  const supabase = createSupabaseAdminClient();
  const { data: existingMedia, error: existingMediaError } = await supabase
    .from("charity_media")
    .select("media_url")
    .eq("id", mediaId)
    .eq("charity_id", charityId)
    .maybeSingle();

  if (existingMediaError) {
    return NextResponse.json({ error: existingMediaError.message }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("charity_media")
    .update({
      media_url: parsed.data.mediaUrl.trim(),
      alt_text: parsed.data.altText.trim(),
      caption: parsed.data.caption?.trim() || null,
      sort_order: parsed.data.sortOrder,
      is_active: parsed.data.isActive,
      updated_at: new Date().toISOString(),
    })
    .eq("id", mediaId)
    .eq("charity_id", charityId)
    .select("id,charity_id,media_url,alt_text,caption,sort_order,is_active")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const previousObjectPath = toCharityMediaObjectPath(existingMedia?.media_url);
  const currentObjectPath = toCharityMediaObjectPath(data.media_url);

  if (previousObjectPath && previousObjectPath !== currentObjectPath) {
    await supabase.storage.from(CHARITY_MEDIA_BUCKET).remove([previousObjectPath]);
  }

  return NextResponse.json({ media: data });
}

export async function DELETE(_request: Request, context: Context) {
  await requireAdmin();

  const { charityId, mediaId } = await context.params;
  const supabase = createSupabaseAdminClient();
  const { data: existingMedia, error: existingMediaError } = await supabase
    .from("charity_media")
    .select("media_url")
    .eq("id", mediaId)
    .eq("charity_id", charityId)
    .maybeSingle();

  if (existingMediaError) {
    return NextResponse.json({ error: existingMediaError.message }, { status: 500 });
  }

  const { error } = await supabase
    .from("charity_media")
    .delete()
    .eq("id", mediaId)
    .eq("charity_id", charityId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const objectPath = toCharityMediaObjectPath(existingMedia?.media_url);
  if (objectPath) {
    await supabase.storage.from(CHARITY_MEDIA_BUCKET).remove([objectPath]);
  }

  return NextResponse.json({ ok: true });
}
