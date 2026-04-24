import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

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
  params: Promise<{ charityId: string }>;
};

export async function GET(_request: Request, context: Context) {
  await requireAdmin();

  const { charityId } = await context.params;
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("charity_events")
    .select("id,charity_id,title,description,event_image_url,location,event_url,starts_at,ends_at,is_published,created_at,updated_at")
    .eq("charity_id", charityId)
    .order("starts_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ events: data ?? [] });
}

export async function POST(request: Request, context: Context) {
  await requireAdmin();

  const payload = await request.json().catch(() => null);
  const parsed = eventSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid charity event payload." }, { status: 400 });
  }

  const { charityId } = await context.params;
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("charity_events")
    .insert({
      charity_id: charityId,
      title: parsed.data.title.trim(),
      description: parsed.data.description.trim(),
      starts_at: parsed.data.startsAt,
      ends_at: parsed.data.endsAt || null,
      location: parsed.data.location?.trim() || null,
      event_url: parsed.data.eventUrl?.trim() || null,
      event_image_url: parsed.data.eventImageUrl?.trim() || null,
      is_published: parsed.data.isPublished,
    })
    .select("id,charity_id,title,description,event_image_url,location,event_url,starts_at,ends_at,is_published")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ event: data });
}
