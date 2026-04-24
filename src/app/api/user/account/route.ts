import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const updateSchema = z.object({
  email: z.email(),
});

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
    },
  });
}

export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid account payload." }, { status: 400 });
  }

  if (parsed.data.email.toLowerCase() === (user.email ?? "").toLowerCase()) {
    return NextResponse.json({ ok: true, message: "Email is unchanged." });
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.updateUser({
    email: parsed.data.email,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    message: "Email update initiated. Please check both old and new inboxes for confirmation.",
  });
}
