import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { assertRequiredProductionEnv } from "@/lib/config/env";

type HealthStatus = "ok" | "degraded";

type DependencyState = {
  status: "up" | "down";
  message?: string;
};

function safeMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Unknown error";
}

export async function GET() {
  const dependencies: Record<string, DependencyState> = {
    env: { status: "up" },
    supabase: { status: "up" },
  };

  try {
    assertRequiredProductionEnv();
  } catch (error) {
    dependencies.env = { status: "down", message: safeMessage(error) };
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.from("charities").select("id", { head: true, count: "exact" }).limit(1);
    if (error) {
      dependencies.supabase = { status: "down", message: error.message };
    }
  } catch (error) {
    dependencies.supabase = { status: "down", message: safeMessage(error) };
  }

  const status: HealthStatus = Object.values(dependencies).some((dep) => dep.status === "down") ? "degraded" : "ok";

  return NextResponse.json(
    {
      ok: status === "ok",
      status,
      service: "digital-heroes-web",
      timestamp: new Date().toISOString(),
      dependencies,
    },
    { status: status === "ok" ? 200 : 503 },
  );
}
