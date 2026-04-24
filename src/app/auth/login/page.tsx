"use client";

import { FormEvent, useState } from "react";
import { motion } from "framer-motion";
import { AnimatedCard, AnimatedChip, AnimatedSection } from "@/components/ui/animated-surface";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [nextPath] = useState(() => {
    if (typeof window === "undefined") return "/dashboard";
    const next = new URLSearchParams(window.location.search).get("next");
    return next?.startsWith("/") ? next : "/dashboard";
  });
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    setMessage("");

    const response = await fetch("/api/auth/magic-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, next: nextPath }),
    });

    const result = (await response.json()) as { message?: string; error?: string };

    if (!response.ok) {
      setStatus("error");
      setMessage(result.error ?? "Unable to send sign-in link.");
      return;
    }

    setStatus("success");
    setMessage(result.message ?? "Check your inbox for a sign-in link.");
  }

  async function onPasswordSubmit() {
    setStatus("loading");
    setMessage("");

    const response = await fetch("/api/auth/password-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, next: nextPath }),
    });

    const result = (await response.json()) as { message?: string; error?: string; redirectTo?: string };

    if (!response.ok) {
      setStatus("error");
      setMessage(result.error ?? "Unable to sign in with password.");
      return;
    }

    setStatus("success");
    setMessage("Signed in successfully. Redirecting...");
    window.location.href = result.redirectTo ?? nextPath;
  }

  async function onPasswordSignup() {
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

    const response = await fetch("/api/auth/password-signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, next: nextPath }),
    });

    const result = (await response.json()) as {
      message?: string;
      error?: string;
      redirectTo?: string;
      requiresEmailConfirmation?: boolean;
    };

    if (!response.ok) {
      setStatus("error");
      setMessage(result.error ?? "Unable to create account.");
      return;
    }

    setStatus("success");
    setMessage(result.message ?? "Account created successfully.");

    if (!result.requiresEmailConfirmation) {
      window.location.href = result.redirectTo ?? nextPath;
    }
  }

  return (
    <AnimatedSection className="mx-auto w-full max-w-lg px-4 py-16 sm:px-6">
      <div className="space-y-4">
        <AnimatedChip className="bg-white/85 text-slate-600">Secure access</AnimatedChip>
        <h1 className="font-display text-5xl text-slate-950">Sign in</h1>
        <p className="max-w-md text-sm leading-relaxed text-slate-600">Use a magic link or a password. New users can also create an account with email and password.</p>
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
            {status === "loading" ? "Sending link..." : "Send magic link"}
          </motion.button>

          <label className="block pt-1 text-sm font-medium text-slate-700" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none ring-slate-300 placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-200"
            placeholder="Enter your password"
          />

          <label className="block pt-1 text-sm font-medium text-slate-700" htmlFor="confirm-password">
            Confirm password (for registration)
          </label>
          <input
            id="confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none ring-slate-300 placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-200"
            placeholder="Re-enter your password"
          />

          <motion.button
            type="button"
            onClick={() => {
              void onPasswordSubmit();
            }}
            disabled={status === "loading" || password.length < 8}
            whileHover={{ y: -2 }}
            whileTap={{ y: 0 }}
            className="inline-flex w-full items-center justify-center rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50 disabled:opacity-70"
          >
            {status === "loading" ? "Signing in..." : "Sign in with password"}
          </motion.button>

          <motion.button
            type="button"
            onClick={() => {
              void onPasswordSignup();
            }}
            disabled={status === "loading" || password.length < 8 || confirmPassword.length < 8}
            whileHover={{ y: -2 }}
            whileTap={{ y: 0 }}
            className="inline-flex w-full items-center justify-center rounded-full border border-slate-300 bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-70"
          >
            {status === "loading" ? "Creating account..." : "Create account with password"}
          </motion.button>

          {message ? (
            <motion.p initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="text-sm text-slate-600">
              {message}
            </motion.p>
          ) : null}
        </form>
      </AnimatedCard>
    </AnimatedSection>
  );
}
