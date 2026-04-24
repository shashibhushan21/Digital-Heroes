import { CharityPreferenceCard } from "@/components/dashboard/charity-preference-card";
import { ParticipationSummaryCard } from "@/components/dashboard/participation-summary-card";
import { ScoreManager } from "@/components/dashboard/score-manager";
import { SubscriptionStatusCard } from "@/components/dashboard/subscription-status-card";
import { WinnerVerificationCard } from "@/components/dashboard/winner-verification-card";
import { AnimatedChip, AnimatedSection } from "@/components/ui/animated-surface";
import Link from "next/link";

export default function DashboardPage() {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:py-16">
      <AnimatedSection className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-3xl space-y-4">
            <AnimatedChip className="border-slate-200 bg-white/80 text-slate-700">Subscriber workspace</AnimatedChip>
            <div>
              <h1 className="font-display text-5xl text-slate-950 sm:text-6xl">Everything you need, in one refined workspace.</h1>
              <p className="mt-3 max-w-2xl text-lg leading-relaxed text-slate-700">
                Manage subscription status, update charity preference, record scores, review participation, and handle winner verification without bouncing between screens.
              </p>
            </div>
          </div>
          <Link
            href="/dashboard/settings"
            className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white/80 px-5 py-3 text-sm font-semibold text-slate-800 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-400 hover:bg-white hover:text-slate-950"
          >
            Open Account Settings
          </Link>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <SubscriptionStatusCard />
          <CharityPreferenceCard />
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <ScoreManager />
          <ParticipationSummaryCard />
        </div>

        <WinnerVerificationCard />
      </AnimatedSection>
    </section>
  );
}
