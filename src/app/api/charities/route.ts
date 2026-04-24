import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get("q")?.trim();
  const featuredOnly = searchParams.get("featured") === "true";

  let dbQuery = supabase
    .from("charities")
    .select("id,slug,name,short_description,long_description,website_url,is_featured,is_active")
    .eq("is_active", true)
    .order("is_featured", { ascending: false })
    .order("name", { ascending: true });

  if (featuredOnly) {
    dbQuery = dbQuery.eq("is_featured", true);
  }

  if (query) {
    dbQuery = dbQuery.or(`name.ilike.%${query}%,short_description.ilike.%${query}%`);
  }

  const { data, error } = await dbQuery;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ charities: data ?? [] });
}
