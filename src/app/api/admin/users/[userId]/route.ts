import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit/logs";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const updateSchema = z.object({
  role: z.enum(["subscriber", "admin"]),
  fullName: z.string().max(160).optional().or(z.literal("")),
  countryCode: z.string().max(8).optional().or(z.literal("")),
  timezone: z.string().min(2).max(80).default("UTC"),
});

type Context = {
  params: Promise<{ userId: string }>;
};

export async function PATCH(request: Request, context: Context) {
  const actor = await requireAdmin();

  const payload = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid user update payload." }, { status: 400 });
  }

  const { userId } = await context.params;
  const supabase = createSupabaseAdminClient();

  const { data: existingUser, error: existingUserError } = await supabase
    .from("users")
    .select("id,role")
    .eq("id", userId)
    .maybeSingle();

  if (existingUserError) {
    return NextResponse.json({ error: existingUserError.message }, { status: 500 });
  }

  if (!existingUser) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  const { error: userUpdateError } = await supabase
    .from("users")
    .update({
      role: parsed.data.role,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (userUpdateError) {
    return NextResponse.json({ error: userUpdateError.message }, { status: 500 });
  }

  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id,full_name,country_code,timezone")
    .eq("user_id", userId)
    .maybeSingle();

  const profilePayload = {
    user_id: userId,
    full_name: parsed.data.fullName?.trim() || null,
    country_code: parsed.data.countryCode?.trim() || null,
    timezone: parsed.data.timezone,
    updated_at: new Date().toISOString(),
  };

  const { error: profileUpdateError } = await supabase
    .from("profiles")
    .upsert(profilePayload, { onConflict: "user_id" });

  if (profileUpdateError) {
    return NextResponse.json({ error: profileUpdateError.message }, { status: 500 });
  }

  await writeAuditLog({
    actorUserId: actor.id,
    entityType: "users",
    entityId: userId,
    action: "admin.user.update",
    oldValues: {
      role: existingUser.role,
      profile: existingProfile ?? null,
    },
    newValues: {
      role: parsed.data.role,
      profile: profilePayload,
    },
  });

  return NextResponse.json({ ok: true });
}
