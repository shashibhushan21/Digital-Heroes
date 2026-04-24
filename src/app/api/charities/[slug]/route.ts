import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type Context = {
  params: Promise<{ slug: string }>;
};

export async function GET(_request: Request, context: Context) {
  const { slug } = await context.params;
  const supabase = await createServerSupabaseClient();

  const { data: charity, error: charityError } = await supabase
    .from("charities")
    .select("id,slug,name,short_description,long_description,website_url,is_featured,is_active")
    .eq("slug", slug)
    .eq("is_active", true)
    .single();

  if (charityError) {
    if (charityError.code === "PGRST116") {
      return NextResponse.json({ error: "Charity not found." }, { status: 404 });
    }
    return NextResponse.json({ error: charityError.message }, { status: 500 });
  }

  const [{ data: media, error: mediaError }, { data: events, error: eventsError }] = await Promise.all([
    supabase
      .from("charity_media")
      .select("id,media_url,alt_text,caption,sort_order")
      .eq("charity_id", charity.id)
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false }),
    supabase
      .from("charity_events")
      .select("id,title,description,event_image_url,location,event_url,starts_at,ends_at,is_published")
      .eq("charity_id", charity.id)
      .eq("is_published", true)
      .order("starts_at", { ascending: false }),
  ]);

  if (mediaError) {
    return NextResponse.json({ error: mediaError.message }, { status: 500 });
  }

  if (eventsError) {
    return NextResponse.json({ error: eventsError.message }, { status: 500 });
  }

  return NextResponse.json({
    charity,
    media: media ?? [],
    events: events ?? [],
  });
}
