"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { AnimatedCard, AnimatedChip, AnimatedSection } from "@/components/ui/animated-surface";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    setMessage("");

    const response = await fetch("/api/auth/password-reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    const result = (await response.json()) as { message?: string; error?: string };

    if (!response.ok) {
      setStatus("error");
      setMessage(result.error ?? "Unable to send password reset email.");
      return;
    }

    setStatus("success");
    setMessage(result.message ?? "Password reset email sent.");
  }

  return (
    <AnimatedSection className="mx-auto w-full max-w-lg px-4 py-16 sm:px-6">
      <div className="space-y-4">
        <AnimatedChip className="bg-white/85 text-slate-600">Account recovery</AnimatedChip>
        <h1 className="font-display text-5xl text-slate-950">Forgot password</h1>
        <p className="max-w-md text-sm leading-relaxed text-slate-600">Enter your account email and we will send you a password reset link.</p>
      </div>

      <AnimatedCard className="mt-8 p-6 sm:p-7">
        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block text-sm font-medium text-slate-700" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none ring-slate-300 placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-200"
            placeholder="you@example.com"
          />

          <motion.button
            type="submit"
            disabled={status === "loading"}
            whileHover={{ y: -2 }}
            whileTap={{ y: 0 }}
            className="inline-flex w-full items-center justify-center rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_35px_-18px_rgba(16,32,58,0.75)] transition hover:bg-slate-800 disabled:opacity-70"
          >
            {status === "loading" ? "Sending..." : "Send reset link"}
          </motion.button>

          {message ? (
            <p className={status === "error" ? "text-sm text-rose-600" : "text-sm text-slate-600"}>{message}</p>
          ) : null}

          <p className="text-sm text-slate-600">
            Remembered your password?{" "}
            <Link className="font-medium text-slate-900 underline decoration-slate-300 underline-offset-4 hover:decoration-slate-500" href="/auth/login">
              Back to sign in
            </Link>
          </p>
        </form>
      </AnimatedCard>
    </AnimatedSection>
  );
}
