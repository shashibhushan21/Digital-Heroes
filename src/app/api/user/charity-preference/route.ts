import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { MIN_CHARITY_PERCENT } from "@/lib/constants/business-rules";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const updateSchema = z.object({
  charityId: z.uuid(),
  contributionPercent: z.number().min(MIN_CHARITY_PERCENT).max(100),
});

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("user_charity_preferences")
    .select("id,charity_id,contribution_percent,effective_from,updated_at,charities(id,name,slug,is_featured)")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ preference: data });
}

export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid preference payload." }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  const { data: charity, error: charityError } = await supabase
    .from("charities")
    .select("id,is_active")
    .eq("id", parsed.data.charityId)
    .maybeSingle();

  if (charityError) {
    return NextResponse.json({ error: charityError.message }, { status: 500 });
  }

  if (!charity || !charity.is_active) {
    return NextResponse.json({ error: "Selected charity is not available." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("user_charity_preferences")
    .upsert(
      {
        user_id: user.id,
        charity_id: parsed.data.charityId,
        contribution_percent: parsed.data.contributionPercent,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    )
    .select("id,charity_id,contribution_percent,effective_from,updated_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ preference: data });
}
