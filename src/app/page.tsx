import Link from "next/link";
import { ArrowRight, Trophy, HeartHandshake, ShieldCheck, Sparkles } from "lucide-react";
import { AnimatedCard, AnimatedChip, AnimatedSection } from "@/components/ui/animated-surface";

export default function Home() {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:py-16">
      <div className="grid gap-8 lg:grid-cols-[1.08fr_0.92fr] lg:items-center">
        <AnimatedSection className="space-y-8">
          <AnimatedChip className="border-amber-200 bg-warm/70 text-slate-700">
            <Sparkles className="mr-2 h-3.5 w-3.5" />
            Modern charity-led golf experience
          </AnimatedChip>

          <div className="space-y-5">
            <h1 className="max-w-3xl font-display text-5xl leading-[0.95] text-slate-950 sm:text-6xl lg:text-7xl">
              Premium golf competition.
              <span className="block text-slate-500">Built around real-world impact.</span>
            </h1>
            <p className="max-w-2xl text-lg leading-relaxed text-slate-700 sm:text-xl">
              Track your Stableford scores, enter monthly draws, and direct every subscription toward a charity you actually want to back.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/subscribe"
              className="group inline-flex items-center justify-center rounded-full bg-ink px-6 py-3 text-sm font-semibold text-white shadow-[0_18px_40px_-20px_rgba(16,32,58,0.7)] transition hover:-translate-y-0.5 hover:bg-slate-800 hover:shadow-[0_24px_50px_-24px_rgba(16,32,58,0.8)]"
            >
              Start Subscription
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              href="/charities"
              className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white/80 px-6 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-400 hover:bg-white hover:text-slate-950"
            >
              Explore Charities
            </Link>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { label: "Monthly cycle", value: "1 draw" },
              { label: "Prize tiers", value: "40 / 35 / 25" },
              { label: "Charity floor", value: "10% minimum" },
            ].map((item) => (
              <AnimatedCard key={item.label} className="p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
                <p className="mt-2 text-xl font-semibold text-slate-950">{item.value}</p>
              </AnimatedCard>
            ))}
          </div>
        </AnimatedSection>

        <AnimatedCard className="relative overflow-hidden p-7">
          <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(16,32,58,0.03),rgba(244,220,193,0.16))]" />
          <div className="relative space-y-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">How it works</p>
                <h2 className="mt-2 font-display text-3xl text-slate-950">Designed to feel polished from the first click</h2>
              </div>
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
                Live monthly flow
              </div>
            </div>

            <div className="space-y-3">
              {[
                { icon: Trophy, title: "Compete", text: "Enter your latest five scores and stay in the draw." },
                { icon: HeartHandshake, title: "Give", text: "Pick a charity and increase your contribution any time." },
                { icon: ShieldCheck, title: "Track", text: "See your subscription, wins, and payout status in one place." },
              ].map((step) => {
                const Icon = step.icon;
                return (
                  <AnimatedCard
                    key={step.title}
                    className="flex items-start gap-4 rounded-2xl border border-slate-200/80 bg-white/70 p-4 transition hover:border-slate-300 hover:bg-white"
                  >
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-[0_12px_30px_-14px_rgba(16,32,58,0.8)]">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-950">{step.title}</p>
                      <p className="mt-1 text-sm leading-relaxed text-slate-600">{step.text}</p>
                    </div>
                  </AnimatedCard>
                );
              })}
            </div>
          </div>
        </AnimatedCard>
      </div>
    </section>
  );
}
