import { NextResponse } from "next/server";
import { z } from "zod";
import { publicEnv } from "@/lib/config/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  email: z.email(),
  next: z.string().startsWith("/").default("/dashboard"),
});

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  const requestOrigin = new URL(request.url).origin;
  const baseUrl = requestOrigin || publicEnv.NEXT_PUBLIC_APP_URL;
  const redirectTo = `${baseUrl}/auth/callback?next=${encodeURIComponent(parsed.data.next)}`;

  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      emailRedirectTo: redirectTo,
    },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ message: "Magic link sent. Please check your inbox." });
}
