"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";

export function MetricCard({
  label,
  children,
  delay = 0,
  highlight = false,
  className = "",
}: {
  label: string;
  children: ReactNode;
  delay?: number;
  highlight?: boolean;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.55, delay, ease: [0.16, 1, 0.3, 1] }}
      className={`relative rounded-xl bg-white/[0.04] backdrop-blur-md border border-white/10 p-5 ${className}`}
      style={
        highlight
          ? {
              borderColor: "color-mix(in srgb, var(--nike-accent) 60%, transparent)",
              boxShadow:
                "0 18px 50px color-mix(in srgb, var(--nike-accent) 30%, transparent), inset 0 1px 0 rgba(255,255,255,0.06)",
            }
          : {
              boxShadow:
                "0 10px 28px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.04)",
            }
      }
    >
      <div className="text-[10px] uppercase tracking-[0.24em] text-white/55 mb-2 flex items-center gap-2">
        <span
          className="w-1.5 h-1.5 rounded-full"
          style={{ background: highlight ? "var(--nike-accent)" : "rgba(255,255,255,0.35)" }}
        />
        {label}
      </div>
      {children}
    </motion.div>
  );
}
