import { z } from "zod";

const optionalTrimmedEmail = z.preprocess((value) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}, z.string().email().optional());

const publicEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.url().default("http://localhost:3000"),
  NEXT_PUBLIC_SUPABASE_URL: z.string().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
});

const serverEnvSchema = z.object({
  ADMIN_EMAIL: optionalTrimmedEmail,
  ADMIN_PASSWORD: z.string().min(8).optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRICE_MONTHLY_ID: z.string().optional(),
  STRIPE_PRICE_YEARLY_ID: z.string().optional(),
  DRAW_POOL_PER_ACTIVE_MINOR: z.coerce.number().int().positive().optional(),
  RESEND_API_KEY: z.string().optional(),
  NOTIFICATION_FROM_EMAIL: optionalTrimmedEmail,
  NOTIFICATION_DISPATCH_SECRET: z.string().min(12).optional(),
  CRON_SECRET: z.string().min(12).optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  DATABASE_URL: z.string().optional(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export const publicEnv = publicEnvSchema.parse({
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
});

export const serverEnv = serverEnvSchema.parse({
  ADMIN_EMAIL: process.env.ADMIN_EMAIL,
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
  STRIPE_PRICE_MONTHLY_ID: process.env.STRIPE_PRICE_MONTHLY_ID,
  STRIPE_PRICE_YEARLY_ID: process.env.STRIPE_PRICE_YEARLY_ID,
  DRAW_POOL_PER_ACTIVE_MINOR: process.env.DRAW_POOL_PER_ACTIVE_MINOR,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  NOTIFICATION_FROM_EMAIL: process.env.NOTIFICATION_FROM_EMAIL,
  NOTIFICATION_DISPATCH_SECRET: process.env.NOTIFICATION_DISPATCH_SECRET,
  CRON_SECRET: process.env.CRON_SECRET,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  DATABASE_URL: process.env.DATABASE_URL,
  NODE_ENV: process.env.NODE_ENV,
});

export function assertRequiredProductionEnv(): void {
  if (process.env.NEXT_PHASE === "phase-production-build") {
    return;
  }

  if (serverEnv.NODE_ENV !== "production") {
    return;
  }

  const required = [
    ["STRIPE_SECRET_KEY", serverEnv.STRIPE_SECRET_KEY],
    ["STRIPE_WEBHOOK_SECRET", serverEnv.STRIPE_WEBHOOK_SECRET],
    ["STRIPE_PRICE_MONTHLY_ID", serverEnv.STRIPE_PRICE_MONTHLY_ID],
    ["STRIPE_PRICE_YEARLY_ID", serverEnv.STRIPE_PRICE_YEARLY_ID],
    ["RESEND_API_KEY", serverEnv.RESEND_API_KEY],
    ["NEXT_PUBLIC_SUPABASE_URL", publicEnv.NEXT_PUBLIC_SUPABASE_URL],
    ["NEXT_PUBLIC_SUPABASE_ANON_KEY", publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY],
  ] as const;

  const missing = required.filter(([, value]) => !value).map(([key]) => key);
  if (missing.length > 0) {
    throw new Error(`Missing required production env vars: ${missing.join(", ")}`);
  }
}
