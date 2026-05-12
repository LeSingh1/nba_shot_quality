"use client";

import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import type { WatchClip } from "@/lib/watchClips";
import { CountUp } from "@/components/nike/CountUp";

type Props = {
  clip: WatchClip;
  onShuffle: () => void;
};

const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * Detail card that sits under the live tracker. Echoes the playoff broadcast
 * scorebug feel — MAKE/MISS pill, series tag, big player name, the four model
 * inputs the row was scored on, and the headline xFG → result line.
 *
 * Animations:
 *   - Card slides in on first paint and on each shuffle (AnimatePresence keyed
 *     by clip.id).
 *   - The four input rows stagger in with a subtle vertical reveal.
 *   - The xFG number CountUps to its terminal value.
 *   - Shuffle button has a magnetic hover + a rotating glyph that spins 180°
 *     per click for tactile feedback.
 */
export function ShotDetailCard({ clip, onShuffle }: Props) {
  const reduce = useReducedMotion();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={clip.id}
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reduce ? { opacity: 0 } : { opacity: 0, y: -16 }}
        transition={{ duration: 0.55, ease: EASE }}
        className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-md"
        style={{
          boxShadow:
            "0 24px 60px -24px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.04)",
        }}
      >
        {/* Faint accent wash behind the result column */}
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 w-1/2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.9, ease: EASE }}
          style={{
            background:
              "radial-gradient(60% 120% at 100% 50%, color-mix(in srgb, var(--nike-accent) 12%, transparent), transparent 70%)",
          }}
        />

        <div className="relative px-6 md:px-8 pt-6 pb-7">
          {/* Header row — pill + series + shuffle */}
          <div className="flex items-center gap-3 flex-wrap">
            <ResultPill made={clip.made} />
            <motion.span
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.45, delay: 0.06, ease: EASE }}
              className="text-[10px] uppercase tracking-[0.22em] text-white/55 font-mono"
            >
              {clip.series}
            </motion.span>
            <ShuffleButton onClick={onShuffle} />
          </div>

          {/* Player + action */}
          <div className="mt-5">
            <motion.h3
              initial={reduce ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.08, ease: EASE }}
              className="font-black leading-[0.95] tracking-tight text-white"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(28px, 3.4vw, 44px)",
              }}
            >
              {clip.player}
            </motion.h3>
            <motion.div
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.18, ease: EASE }}
              className="mt-1.5 text-sm text-white/55"
            >
              {clip.action}
            </motion.div>
          </div>

          {/* What the model saw */}
          <div className="mt-6 border-t border-white/8 pt-5">
            <motion.div
              initial={reduce ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.18, ease: EASE }}
              className="text-[10px] uppercase tracking-[0.24em] text-white/40 mb-4 flex items-center gap-2"
            >
              <span className="w-3 h-px bg-white/30" />
              What the model saw
            </motion.div>

            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-3">
              <InputRow label="Where" value={clip.inputs.where} delay={0.22} />
              <InputRow label="How" value={clip.inputs.how} delay={0.28} />
              <InputRow label="When" value={clip.inputs.when} delay={0.34} />
              <InputRow
                label="Situation"
                value={clip.inputs.situation}
                delay={0.40}
              />
            </dl>
          </div>

          {/* Result line */}
          <div className="mt-6 border-t border-white/8 pt-5 grid grid-cols-1 md:grid-cols-[1fr_auto] md:items-end gap-5 md:gap-10">
            <motion.p
              initial={reduce ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.46, ease: EASE }}
              className="text-[14px] leading-[1.55] text-white/75"
            >
              Combining those four, the model expected this to fall{" "}
              <span
                className="font-bold tabular-nums"
                style={{ color: "var(--nike-accent)" }}
              >
                <CountUp value={Math.round(clip.modelXfg * 100)} decimals={0} />%
              </span>{" "}
              of the time.
            </motion.p>

            <motion.div
              initial={reduce ? false : { opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.55, delay: 0.5, ease: EASE }}
              className="text-right"
            >
              <div className="text-[10px] uppercase tracking-[0.22em] text-white/40 font-mono">
                xFG · result
              </div>
              <div className="mt-1.5 flex items-baseline justify-end gap-2">
                <span
                  className="font-black tabular-nums leading-none"
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: 36,
                    color: "var(--nike-accent)",
                    textShadow:
                      "0 2px 22px color-mix(in srgb, var(--nike-accent) 45%, transparent)",
                  }}
                >
                  <CountUp value={Math.round(clip.modelXfg * 100)} decimals={0} />%
                </span>
                <span className="text-[11px] uppercase tracking-[0.18em] text-white/55 font-mono">
                  → {clip.made ? "MAKE" : "MISS"}
                </span>
              </div>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

/* ───────────────────────────────────────────────── presenters */

function ResultPill({ made }: { made: boolean }) {
  const tone = made
    ? {
        border: "rgba(52, 211, 153, 0.55)",
        bg: "rgba(52, 211, 153, 0.10)",
        fg: "#34D399",
        dot: "#34D399",
      }
    : {
        border: "color-mix(in srgb, var(--nike-accent) 55%, transparent)",
        bg: "color-mix(in srgb, var(--nike-accent) 12%, transparent)",
        fg: "var(--nike-accent)",
        dot: "var(--nike-accent)",
      };
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: EASE }}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-mono uppercase tracking-[0.2em]"
      style={{
        border: `1px solid ${tone.border}`,
        background: tone.bg,
        color: tone.fg,
      }}
    >
      <motion.span
        className="w-1.5 h-1.5 rounded-full"
        style={{ background: tone.dot }}
        animate={{ opacity: [0.55, 1, 0.55] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
      />
      {made ? "Make" : "Miss"}
    </motion.span>
  );
}

function ShuffleButton({ onClick }: { onClick: () => void }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.96 }}
      className="ml-auto group inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-3.5 py-1.5 text-[10px] uppercase tracking-[0.2em] text-white/70 hover:text-white hover:border-white/40 transition-colors"
      aria-label="Shuffle to a different clip"
    >
      <motion.svg
        viewBox="0 0 16 16"
        width="11"
        height="11"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        aria-hidden
        whileHover={{ rotate: 180 }}
        transition={{ duration: 0.45, ease: EASE }}
      >
        <path d="M2 4h7l2.5 2.5M14 4l-2 2-2-2M2 12h7l2.5-2.5M14 12l-2-2-2 2" />
      </motion.svg>
      Shuffle clip
    </motion.button>
  );
}

function InputRow({
  label,
  value,
  delay,
}: {
  label: string;
  value: string;
  delay: number;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease: EASE }}
      className="flex items-baseline gap-4 border-b border-white/5 pb-2.5 last:border-b-0 sm:border-b-0 sm:pb-0"
    >
      <dt className="w-[78px] shrink-0 text-[10px] uppercase tracking-[0.18em] text-white/40 font-mono">
        {label}
      </dt>
      <dd className="text-[14px] text-white/90 leading-snug">{value}</dd>
    </motion.div>
  );
}
