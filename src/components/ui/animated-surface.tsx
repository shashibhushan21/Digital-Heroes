"use client";

import { motion } from "framer-motion";
import { twMerge } from "tailwind-merge";

type AnimatedSurfaceProps = {
  children: React.ReactNode;
  className?: string;
};

const riseIn = {
  initial: { opacity: 1, y: 0 },
  whileInView: { opacity: 1, y: 0 },
  transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } as const,
  viewport: { once: true, amount: 0.25 },
} as const;

export function AnimatedSection({ children, className }: AnimatedSurfaceProps) {
  return (
    <motion.section
      initial={riseIn.initial}
      whileInView={riseIn.whileInView}
      transition={riseIn.transition}
      viewport={riseIn.viewport}
      className={twMerge(className)}
    >
      {children}
    </motion.section>
  );
}

export function AnimatedCard({ children, className }: AnimatedSurfaceProps) {
  return (
    <motion.div
      initial={{ opacity: 1, y: 0 }}
      whileInView={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] } as const}
      viewport={{ once: true, amount: 0.2 }}
      className={twMerge(
        "group rounded-[1.75rem] border border-slate-200/80 bg-white/78 p-6 shadow-[0_18px_50px_-28px_rgba(15,23,42,0.38)] backdrop-blur-xl transition-colors duration-300 hover:border-slate-300 hover:shadow-[0_24px_70px_-36px_rgba(15,23,42,0.48)]",
        className,
      )}
    >
      {children}
    </motion.div>
  );
}

export function AnimatedChip({ children, className }: AnimatedSurfaceProps) {
  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
      className={twMerge(
        "inline-flex items-center rounded-full border border-slate-200/80 bg-white/80 px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm transition-colors hover:border-slate-300 hover:text-slate-900",
        className,
      )}
    >
      {children}
    </motion.div>
  );
}
