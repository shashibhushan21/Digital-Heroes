import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const createSchema = z.object({
  slug: z.string().min(2).max(80),
  name: z.string().min(2).max(120),
  shortDescription: z.string().min(10).max(240),
  longDescription: z.string().min(20).max(4000),
  websiteUrl: z.url().optional().or(z.literal("")),
  isFeatured: z.boolean().default(false),
});

function isMissingOptionalTableError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "42P01") return true;
  return /does not exist/i.test(error.message ?? "");
}

export async function GET() {
  await requireAdmin();

  const supabase = createSupabaseAdminClient();
  const { data: charities, error } = await supabase
    .from("charities")
    .select(
      "id,slug,name,short_description,long_description,website_url,is_featured,is_active,created_at,updated_at",
    )
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const charityIds = (charities ?? []).map((charity) => charity.id);
  if (charityIds.length === 0) {
    return NextResponse.json({ charities: [] });
  }

  const [mediaResult, eventsResult] = await Promise.all([
    supabase
      .from("charity_media")
      .select("id,charity_id,media_url,alt_text,caption,sort_order,is_active")
      .in("charity_id", charityIds)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false }),
    supabase
      .from("charity_events")
      .select("id,charity_id,title,description,event_image_url,location,event_url,starts_at,ends_at,is_published")
      .in("charity_id", charityIds)
      .order("starts_at", { ascending: false }),
  ]);

  if (mediaResult.error && !isMissingOptionalTableError(mediaResult.error)) {
    return NextResponse.json({ error: mediaResult.error.message }, { status: 500 });
  }

  if (eventsResult.error && !isMissingOptionalTableError(eventsResult.error)) {
    return NextResponse.json({ error: eventsResult.error.message }, { status: 500 });
  }

  type MediaRow = { charity_id: string; id: string; media_url: string; alt_text: string; caption: string | null; sort_order: number; is_active: boolean };
  type EventRow = { charity_id: string; id: string; title: string; description: string; event_image_url: string | null; location: string | null; event_url: string | null; starts_at: string; ends_at: string | null; is_published: boolean };

  const mediaByCharity = new Map<string, MediaRow[]>();
  for (const media of (mediaResult.data ?? []) as MediaRow[]) {
    const existing = mediaByCharity.get(media.charity_id) ?? [];
    existing.push(media);
    mediaByCharity.set(media.charity_id, existing);
  }

  const eventsByCharity = new Map<string, EventRow[]>();
  for (const event of (eventsResult.data ?? []) as EventRow[]) {
    const existing = eventsByCharity.get(event.charity_id) ?? [];
    existing.push(event);
    eventsByCharity.set(event.charity_id, existing);
  }

  const hydrated = (charities ?? []).map((charity) => ({
    ...charity,
    charity_media: mediaByCharity.get(charity.id) ?? [],
    charity_events: eventsByCharity.get(charity.id) ?? [],
  }));

  return NextResponse.json({ charities: hydrated });
}

export async function POST(request: Request) {
  await requireAdmin();

  const payload = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid charity payload." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("charities")
    .insert({
      slug: parsed.data.slug.trim().toLowerCase(),
      name: parsed.data.name.trim(),
      short_description: parsed.data.shortDescription.trim(),
      long_description: parsed.data.longDescription.trim(),
      website_url: parsed.data.websiteUrl?.trim() || null,
      is_featured: parsed.data.isFeatured,
      is_active: true,
    })
    .select("id,slug,name,short_description,long_description,website_url,is_featured,is_active")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ charity: data });
}
