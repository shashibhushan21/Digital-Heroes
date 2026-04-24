import { CharityDirectory } from "@/components/charities/charity-directory";
import { AnimatedChip } from "@/components/ui/animated-surface";

export default function CharitiesPage() {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6">
      <div className="max-w-3xl space-y-4">
        <AnimatedChip className="bg-white/85 text-slate-600">Discover causes</AnimatedChip>
        <h1 className="font-display text-5xl text-slate-950">Charity Directory</h1>
        <p className="max-w-2xl text-lg leading-relaxed text-slate-700">
          Explore available causes and choose where your subscription impact should go.
        </p>
      </div>
      <CharityDirectory />
    </section>
  );
}
