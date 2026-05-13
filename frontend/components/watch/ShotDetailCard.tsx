"use client";

import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import type { WatchClip } from "@/lib/watchClips";

type Props = {
  clip: WatchClip;
  onShuffle: () => void;
};

const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * Editorial detail slab for the current clip.
 *
 *   Top strip:   result chip · series tag · shuffle button
 *   Headline:    player name (oversized), action subtitle
 *   Inputs:      four annotated chips with mini icons (Where / How / When /
 *                Situation) reading as a single line of scout copy, not a
 *                label-value grid
 *   Verdict:     one-line takeaway integrating the model's xFG read
 *
 * The right-rail ReleaseProfile owns the headline xFG number, so this card
 * stays focused on context and copy. Motion: stagger the input chips on a
 * 35ms cadence per ui-ux-pro-max §7 stagger-sequence.
 */
export function ShotDetailCard({ clip, onShuffle }: Props) {
  const reduce = useReducedMotion();

  const tone = clip.made
    ? {
        chipBorder: "rgba(52,211,153,0.5)",
        chipBg: "rgba(52,211,153,0.08)",
        chipFg: "#34D399",
        verdict: "#34D399",
        verb: "drained it",
      }
    : {
        chipBorder: "color-mix(in srgb, var(--nike-accent) 55%, transparent)",
        chipBg: "color-mix(in srgb, var(--nike-accent) 10%, transparent)",
        chipFg: "var(--nike-accent)",
        verdict: "var(--nike-accent)",
        verb: "rimmed out",
      };

  const pct = Math.round(clip.modelXfg * 100);

  return (
    <AnimatePresence mode="wait">
      <motion.article
        key={clip.id}
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
        transition={{ duration: 0.42, ease: EASE }}
        className="
          relative overflow-hidden rounded-2xl
          border border-white/8
          bg-gradient-to-b from-white/[0.04] to-white/[0.01]
        "
      >
        {/* Accent rail — colored thread on the left tying the card to the
            make/miss verdict without a heavy border. */}
        <span
          aria-hidden
          className="absolute left-0 top-6 bottom-6 w-[2px] rounded-r"
          style={{ background: tone.chipFg, opacity: 0.55 }}
        />

        <div className="px-6 md:px-8 py-7">
          {/* Top strip */}
          <div className="flex items-center gap-3 flex-wrap">
            <ResultChip made={clip.made} tone={tone} />
            <SeriesLabel series={clip.series} />
            <ShuffleButton onClick={onShuffle} />
          </div>

          {/* Headline */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-[1fr_auto] md:items-end gap-4 md:gap-8">
            <motion.h3
              initial={reduce ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.08, ease: EASE }}
              className="font-black leading-[0.92] tracking-[-0.025em] text-white"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(34px, 4vw, 56px)",
              }}
            >
              {clip.player}
            </motion.h3>
            <motion.div
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.18, ease: EASE }}
              className="text-right md:pb-2"
            >
              <div className="text-[10px] uppercase tracking-[0.24em] font-mono text-white/40">
                Shot type
              </div>
              <div className="text-white/85 text-[15px] font-medium mt-1 tabular-nums">
                {clip.action}
              </div>
            </motion.div>
          </div>

          {/* What the model saw — inline chips, not a 2-col list */}
          <div className="mt-7">
            <motion.div
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.22, ease: EASE }}
              className="text-[10px] uppercase tracking-[0.28em] font-mono text-white/40 mb-3.5"
            >
              What the model saw
            </motion.div>

            <ul className="flex flex-wrap gap-2">
              <InputChip
                icon={IconPin}
                label="Where"
                value={clip.inputs.where}
                delay={0.26}
              />
              <InputChip
                icon={IconCrosshair}
                label="How"
                value={clip.inputs.how}
                delay={0.32}
              />
              <InputChip
                icon={IconClock}
                label="When"
                value={clip.inputs.when}
                delay={0.38}
              />
              <InputChip
                icon={IconShield}
                label="Situation"
                value={clip.inputs.situation}
                delay={0.44}
              />
            </ul>
          </div>

          {/* Verdict line */}
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.5, ease: EASE }}
            className="mt-7 pt-5 border-t border-white/8"
          >
            <p className="text-[15px] leading-[1.55] text-white/80">
              Model gave it{" "}
              <span
                className="font-bold tabular-nums"
                style={{ color: tone.verdict }}
              >
                {pct}%
              </span>{" "}
              before release ·{" "}
              <span style={{ color: tone.verdict }} className="font-semibold">
                {clip.player.split(" ").pop()} {tone.verb}.
              </span>
            </p>
          </motion.div>
        </div>
      </motion.article>
    </AnimatePresence>
  );
}

/* ───────────────────────────────────────────────────────── presenters */

function ResultChip({
  made,
  tone,
}: {
  made: boolean;
  tone: { chipBorder: string; chipBg: string; chipFg: string };
}) {
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 320, damping: 22 }}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono uppercase tracking-[0.22em]"
      style={{
        border: `1px solid ${tone.chipBorder}`,
        background: tone.chipBg,
        color: tone.chipFg,
      }}
    >
      <span
        aria-hidden
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: tone.chipFg }}
      />
      {made ? "Make" : "Miss"}
    </motion.span>
  );
}

function SeriesLabel({ series }: { series: string }) {
  return (
    <motion.span
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, delay: 0.06, ease: EASE }}
      className="text-[10px] uppercase tracking-[0.22em] text-white/55 font-mono"
    >
      {series}
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
      transition={{ type: "spring", stiffness: 320, damping: 18 }}
      className="ml-auto inline-flex items-center gap-2 rounded-full border border-white/15 px-3.5 py-1.5 text-[10px] uppercase tracking-[0.2em] text-white/75 hover:text-white hover:border-white/40 transition-colors"
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

function InputChip({
  icon: Icon,
  label,
  value,
  delay,
}: {
  icon: (props: { className?: string }) => React.ReactNode;
  label: string;
  value: string;
  delay: number;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.li
      initial={reduce ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease: EASE }}
      whileHover={reduce ? undefined : { y: -1 }}
      className="
        group inline-flex items-center gap-2.5
        rounded-lg
        border border-white/10
        bg-white/[0.025] hover:bg-white/[0.05]
        px-3 py-2
        transition-colors
      "
    >
      <span className="text-white/45 group-hover:text-white/70 transition-colors">
        <Icon className="w-3.5 h-3.5" />
      </span>
      <span className="flex items-baseline gap-2 min-w-0">
        <span className="text-[9px] uppercase tracking-[0.22em] font-mono text-white/40 shrink-0">
          {label}
        </span>
        <span className="text-[13px] text-white/90 truncate">{value}</span>
      </span>
    </motion.li>
  );
}

/* ───────────────────────────────────────────────── inline icons (lucide) */

function IconPin({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function IconCrosshair({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <line x1="22" y1="12" x2="18" y2="12" />
      <line x1="6" y1="12" x2="2" y2="12" />
      <line x1="12" y1="6" x2="12" y2="2" />
      <line x1="12" y1="22" x2="12" y2="18" />
    </svg>
  );
}

function IconClock({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15 14" />
    </svg>
  );
}

function IconShield({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z" />
    </svg>
  );
}
