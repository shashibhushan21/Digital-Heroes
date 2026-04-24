"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, BadgeDollarSign, CalendarRange, Trophy } from "lucide-react";
import type { PlanCode } from "@/lib/billing/plans";
import { AnimatedCard, AnimatedChip, AnimatedSection } from "@/components/ui/animated-surface";

export default function SubscribePage() {
  const [checkoutStatus] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get("checkout");
  });
  const [loadingPlan, setLoadingPlan] = useState<PlanCode | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isVerifyingAccess = checkoutStatus === "success" && !errorMessage;

  useEffect(() => {
    if (checkoutStatus !== "success") {
      return;
    }

    let attempts = 0;
    let cancelled = false;

    const intervalId = window.setInterval(async () => {
      attempts += 1;

      try {
        const response = await fetch("/api/subscription/status", { cache: "no-store" });
        const payload = (await response.json()) as { hasAccess?: boolean };

        if (!cancelled && response.ok && payload.hasAccess) {
          window.clearInterval(intervalId);
          window.location.href = "/dashboard";
          return;
        }
      } catch {
        // Ignore transient polling/network issues and keep retrying.
      }

      if (attempts >= 10 && !cancelled) {
        window.clearInterval(intervalId);
        setErrorMessage(
          "Payment completed, but subscription sync is still processing. Refresh this page in a few seconds.",
        );
      }
    }, 1500);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [checkoutStatus]);

  async function startCheckout(planCode: PlanCode) {
    setLoadingPlan(planCode);
    setErrorMessage(null);

    const response = await fetch("/api/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planCode }),
    });

    const payload = (await response.json()) as { url?: string; error?: string };

    if (!response.ok || !payload.url) {
      setErrorMessage(payload.error ?? "Unable to start checkout.");
      setLoadingPlan(null);
      return;
    }

    window.location.href = payload.url;
  }

  return (
    <AnimatedSection className="mx-auto w-full max-w-5xl px-4 py-14 sm:px-6">
      <div className="grid gap-8 lg:grid-cols-[1fr_0.9fr] lg:items-start">
        <div className="space-y-5">
          <AnimatedChip className="bg-white/85 text-slate-600">Subscription</AnimatedChip>
          <h1 className="font-display text-5xl text-slate-950">Choose your subscription</h1>
          <p className="max-w-2xl text-lg leading-relaxed text-slate-700">
            Select a plan to unlock score tracking, draw participation, and charity contributions.
          </p>

          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { icon: CalendarRange, title: "Monthly", text: "Flexible, easy to renew" },
              { icon: BadgeDollarSign, title: "Yearly", text: "Lower total cost over time" },
              { icon: Trophy, title: "Access", text: "Unlock all premium tools" },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <AnimatedCard key={item.title} className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-950 text-white">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-950">{item.title}</p>
                      <p className="text-xs text-slate-600">{item.text}</p>
                    </div>
                  </div>
                </AnimatedCard>
              );
            })}
          </div>
        </div>

        <AnimatedCard className="space-y-4 p-6">
          {checkoutStatus === "success" ? (
            <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              Payment successful. {isVerifyingAccess ? "Activating your subscription and redirecting to dashboard..." : "Please wait..."}
            </p>
          ) : null}

          {checkoutStatus === "cancel" ? (
            <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Checkout was canceled. You can select a plan and try again.
            </p>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <motion.button
              onClick={() => startCheckout("monthly")}
              disabled={loadingPlan !== null}
              whileHover={{ y: -3 }}
              whileTap={{ y: 0 }}
              className="rounded-3xl border border-slate-300 bg-white p-5 text-left shadow-sm transition hover:border-slate-400 hover:shadow-[0_18px_40px_-24px_rgba(16,32,58,0.45)] disabled:opacity-70"
            >
              <h2 className="text-lg font-semibold text-slate-950">Monthly Plan</h2>
              <p className="mt-1 text-sm text-slate-600">Flexible month-to-month access.</p>
              <span className="mt-4 inline-flex items-center text-sm font-semibold text-slate-900">
                Choose monthly <ArrowRight className="ml-2 h-4 w-4" />
              </span>
            </motion.button>

            <motion.button
              onClick={() => startCheckout("yearly")}
              disabled={loadingPlan !== null}
              whileHover={{ y: -3 }}
              whileTap={{ y: 0 }}
              className="rounded-3xl border border-slate-300 bg-white p-5 text-left shadow-sm transition hover:border-slate-400 hover:shadow-[0_18px_40px_-24px_rgba(16,32,58,0.45)] disabled:opacity-70"
            >
              <h2 className="text-lg font-semibold text-slate-950">Yearly Plan</h2>
              <p className="mt-1 text-sm text-slate-600">Best value with discounted annual billing.</p>
              <span className="mt-4 inline-flex items-center text-sm font-semibold text-slate-900">
                Choose yearly <ArrowRight className="ml-2 h-4 w-4" />
              </span>
            </motion.button>
          </div>

          {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}
        </AnimatedCard>
      </div>
    </AnimatedSection>
  );
}
