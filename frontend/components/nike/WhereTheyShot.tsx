"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import type { ShotsMap } from "@/lib/types";
import { FEATURED } from "@/lib/featured";
import { ShotMap, type ShotDatum } from "../court/ShotMap";

type Mode = "all" | "makes" | "misses";

/**
 * "Where they shot" — top-down half-court shot scatter for the selected
 * player. Flat geometry (no 3D tilt) matches the standard you see on
 * basketball-reference, Cleaning the Glass, PBPStats.
 */
export function WhereTheyShot({ shots }: { shots: ShotsMap }) {
  const [playerId, setPlayerId] = useState<number>(FEATURED[0].id);
  const [mode, setMode] = useState<Mode>("all");

  const player = FEATURED.find((p) => p.id === playerId)!;
  const entry = shots[String(playerId)];
  const allShots: ShotDatum[] = entry?.shots ?? [];

  const filtered = useMemo(() => {
    if (mode === "makes")  return allShots.filter((s) => s.made === 1);
    if (mode === "misses") return allShots.filter((s) => s.made === 0);
    return allShots;
  }, [allShots, mode]);

  const madeCount = allShots.filter((s) => s.made === 1).length;

  return (
    <section
      id="where-they-shot"
      className="relative bg-[#0a0a0a] text-white py-24 px-8 md:px-16 overflow-hidden"
    >
      {/* Subtle accent backdrop wash */}
      <motion.div
        aria-hidden
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-[80%] rounded-full pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at center, ${player.primary}20 0%, transparent 70%)`,
          filter: "blur(60px)",
        }}
        animate={{ opacity: [0.55, 0.8, 0.55] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="relative max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10 border-b border-white/10 pb-5">
          <div>
            <div className="text-[11px] uppercase tracking-[0.22em] text-white/40 mb-2">
              02 · Shot Map
            </div>
            <h2
              className="font-bold leading-tight"
              style={{ fontFamily: "var(--font-display)", fontSize: "clamp(36px,4.5vw,72px)" }}
            >
              Where they shot.
            </h2>
            <p className="text-sm text-white/55 mt-3 max-w-2xl">
              Every playoff attempt for{" "}
              <span style={{ color: player.primary }}>
                {player.firstName} {player.lastName}
              </span>
              , plotted on the half-court. Green = make, red = miss. Hover any dot
              for distance, xFG%, and outcome.
            </p>
          </div>

          {/* Mode tabs */}
          <div className="inline-flex rounded-full border border-white/10 bg-white/[0.03] p-1">
            {(["all", "makes", "misses"] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className="relative px-5 py-2 text-xs uppercase tracking-[0.18em] rounded-full"
              >
                {mode === m && (
                  <motion.span
                    layoutId="wts-mode-pill"
                    className="absolute inset-0 rounded-full"
                    style={{ background: player.primary }}
                    transition={{ type: "spring", stiffness: 280, damping: 28 }}
                  />
                )}
                <span
                  className="relative"
                  style={{ color: mode === m ? "#fff" : "rgba(255,255,255,0.55)" }}
                >
                  {m === "all" ? "All shots" : m === "makes" ? "Makes" : "Misses"}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-12 gap-8">
          {/* Player rail */}
          <div className="col-span-12 md:col-span-3 space-y-1">
            <div className="text-[11px] uppercase tracking-[0.2em] text-white/40 mb-3">
              Player · {FEATURED.length}
            </div>
            {FEATURED.map((p) => {
              const ps = shots[String(p.id)]?.shots ?? [];
              const isActive = p.id === playerId;
              const hasData = ps.length > 0;
              return (
                <motion.button
                  key={p.id}
                  onClick={() => setPlayerId(p.id)}
                  whileHover={{ x: 4 }}
                  transition={{ type: "spring", stiffness: 280, damping: 24 }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition relative disabled:opacity-40"
                  disabled={!hasData}
                  style={{
                    background: isActive ? "rgba(255,255,255,0.06)" : "transparent",
                  }}
                >
                  {isActive && (
                    <motion.span
                      layoutId="wts-active"
                      className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r"
                      style={{ background: p.primary }}
                      transition={{ type: "spring", stiffness: 280, damping: 28 }}
                    />
                  )}
                  <span className="font-medium text-left pl-3">
                    {p.firstName.charAt(0)}. {p.lastName}
                  </span>
                  <span className="ml-3 text-[10px] uppercase tracking-wider text-white/35 font-mono">
                    {hasData ? ps.length : "—"}
                  </span>
                </motion.button>
              );
            })}
          </div>

          {/* Shot map */}
          <div className="col-span-12 md:col-span-9">
            <ShotMap shots={filtered} accent={player.primary} mode="result" />

            <div className="mt-4 flex items-center justify-between text-[11px] uppercase tracking-[0.18em] text-white/40">
              <AnimatePresence mode="wait">
                <motion.span
                  key={`${playerId}-${mode}`}
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.3 }}
                >
                  {filtered.length} {mode === "all" ? "attempts" : mode} · {madeCount}/{allShots.length} made overall
                </motion.span>
              </AnimatePresence>
              <span>top-down · official NBA half-court dimensions</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
