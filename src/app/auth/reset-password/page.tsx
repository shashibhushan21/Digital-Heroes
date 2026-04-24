"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { AnimatedCard, AnimatedChip, AnimatedSection } from "@/components/ui/animated-surface";
import { createClientSupabaseClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [hasRecoverySession, setHasRecoverySession] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("Preparing secure reset...");

  useEffect(() => {
    const supabase = createClientSupabaseClient();

    const bootstrap = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        setHasRecoverySession(true);
        setMessage("");
        return;
      }

      if (!window.location.hash.includes("access_token")) {
        setHasRecoverySession(false);
        setMessage("Reset link is invalid or expired. Request a new password reset email.");
      }
    };

    void bootstrap();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setHasRecoverySession(true);
        setMessage("");
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (password.length < 8) {
      setStatus("error");
      setMessage("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setStatus("error");
      setMessage("Passwords do not match.");
      return;
    }

    setStatus("loading");
    setMessage("");

    const supabase = createClientSupabaseClient();
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setStatus("error");
      setMessage(error.message);
      return;
    }

    await supabase.auth.signOut();
    setStatus("success");
    setMessage("Password updated. Redirecting to sign in...");

    setTimeout(() => {
      router.push("/auth/login");
    }, 900);
  }

  return (
    <AnimatedSection className="mx-auto w-full max-w-lg px-4 py-16 sm:px-6">
      <div className="space-y-4">
        <AnimatedChip className="bg-white/85 text-slate-600">Account recovery</AnimatedChip>
        <h1 className="font-display text-5xl text-slate-950">Reset password</h1>
        <p className="max-w-md text-sm leading-relaxed text-slate-600">Use a new password with at least 8 characters.</p>
      </div>

      <AnimatedCard className="mt-8 p-6 sm:p-7">
        {hasRecoverySession ? (
          <form onSubmit={onSubmit} className="space-y-4">
            <label className="block text-sm font-medium text-slate-700" htmlFor="password">
              New password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none ring-slate-300 placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-200"
              placeholder="Enter new password"
            />

            <label className="block text-sm font-medium text-slate-700" htmlFor="confirm-password">
              Confirm new password
            </label>
            <input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none ring-slate-300 placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-200"
              placeholder="Re-enter new password"
            />

            <motion.button
              type="submit"
              disabled={status === "loading"}
              whileHover={{ y: -2 }}
              whileTap={{ y: 0 }}
              className="inline-flex w-full items-center justify-center rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_35px_-18px_rgba(16,32,58,0.75)] transition hover:bg-slate-800 disabled:opacity-70"
            >
              {status === "loading" ? "Updating..." : "Update password"}
            </motion.button>
          </form>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">{message}</p>
            <Link className="inline-flex rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50" href="/auth/forgot-password">
              Request new reset link
            </Link>
          </div>
        )}

        {hasRecoverySession && message ? (
          <p className={status === "error" ? "mt-4 text-sm text-rose-600" : "mt-4 text-sm text-slate-600"}>{message}</p>
        ) : null}
      </AnimatedCard>
    </AnimatedSection>
  );
}
