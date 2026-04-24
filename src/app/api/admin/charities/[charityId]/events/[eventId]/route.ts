import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const CHARITY_MEDIA_BUCKET = "charity-media";
const CHARITY_MEDIA_PUBLIC_PREFIX = `/storage/v1/object/public/${CHARITY_MEDIA_BUCKET}/`;

const eventSchema = z.object({
  title: z.string().min(3).max(120),
  description: z.string().min(10).max(1500),
  startsAt: z.iso.datetime(),
  endsAt: z.iso.datetime().optional().or(z.literal("")),
  location: z.string().max(180).optional().or(z.literal("")),
  eventUrl: z.url().optional().or(z.literal("")),
  eventImageUrl: z.url().optional().or(z.literal("")),
  isPublished: z.boolean().default(true),
});

type Context = {
  params: Promise<{ charityId: string; eventId: string }>;
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
  const parsed = eventSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid charity event update payload." }, { status: 400 });
  }

  const { charityId, eventId } = await context.params;
  const supabase = createSupabaseAdminClient();
  const { data: existingEvent, error: existingEventError } = await supabase
    .from("charity_events")
    .select("event_image_url")
    .eq("id", eventId)
    .eq("charity_id", charityId)
    .maybeSingle();

  if (existingEventError) {
    return NextResponse.json({ error: existingEventError.message }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("charity_events")
    .update({
      title: parsed.data.title.trim(),
      description: parsed.data.description.trim(),
      starts_at: parsed.data.startsAt,
      ends_at: parsed.data.endsAt || null,
      location: parsed.data.location?.trim() || null,
      event_url: parsed.data.eventUrl?.trim() || null,
      event_image_url: parsed.data.eventImageUrl?.trim() || null,
      is_published: parsed.data.isPublished,
      updated_at: new Date().toISOString(),
    })
    .eq("id", eventId)
    .eq("charity_id", charityId)
    .select("id,charity_id,title,description,event_image_url,location,event_url,starts_at,ends_at,is_published")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const previousObjectPath = toCharityMediaObjectPath(existingEvent?.event_image_url);
  const currentObjectPath = toCharityMediaObjectPath(data.event_image_url);

  if (previousObjectPath && previousObjectPath !== currentObjectPath) {
    await supabase.storage.from(CHARITY_MEDIA_BUCKET).remove([previousObjectPath]);
  }

  return NextResponse.json({ event: data });
}

export async function DELETE(_request: Request, context: Context) {
  await requireAdmin();

  const { charityId, eventId } = await context.params;
  const supabase = createSupabaseAdminClient();
  const { data: existingEvent, error: existingEventError } = await supabase
    .from("charity_events")
    .select("event_image_url")
    .eq("id", eventId)
    .eq("charity_id", charityId)
    .maybeSingle();

  if (existingEventError) {
    return NextResponse.json({ error: existingEventError.message }, { status: 500 });
  }

  const { error } = await supabase
    .from("charity_events")
    .delete()
    .eq("id", eventId)
    .eq("charity_id", charityId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const objectPath = toCharityMediaObjectPath(existingEvent?.event_image_url);
  if (objectPath) {
    await supabase.storage.from(CHARITY_MEDIA_BUCKET).remove([objectPath]);
  }

  return NextResponse.json({ ok: true });
}
