"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { HalfCourt } from "./HalfCourt";
import { COURT, isThreePointer, shotDistFt } from "./court-dimensions";

export type ShotDatum = { x: number; y: number; made: 0 | 1; xfg: number };

/**
 * Reusable shot scatter. NBA-native coordinates throughout — a shot at
 * (LOC_X=120, LOC_Y=240) plots at SVG (120, 240) with no conversion.
 *
 *   tilted=false (default): flat top-down, used for "Where they shot" + replay
 *   tilted=true:            CSS rotateX(55deg) — used for the Laboratory map
 *
 * Color mode:
 *   "result"   — green = make, red = miss
 *   "residual" — blue = under-performed (model expected a make), red = tough make
 *   "debug"    — cyan = 3PT zone, magenta = 2PT zone (verifies geometry)
 *
 * Add `?debug=1` to the URL and the mode auto-switches to "debug" — every
 * dot is colored by its geometric class so you can eyeball whether the arc
 * lines up with the shot locations.
 */
export function ShotMap({
  shots,
  mode = "result",
  accent = "#FF2D6F",
  onSelect,
  selectedIndex = null,
  tilted = false,
}: {
  shots: ShotDatum[];
  mode?: "result" | "residual";
  accent?: string;
  onSelect?: (i: number) => void;
  selectedIndex?: number | null;
  tilted?: boolean;
}) {
  // Debug overlay toggled via ?debug=1
  const [debug, setDebug] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    setDebug(sp.get("debug") === "1");
  }, []);

  const effectiveMode: "result" | "residual" | "debug" = debug ? "debug" : mode;

  return (
    <div
      className="relative w-full bg-[#0a0a0a] rounded-xl overflow-hidden ring-1 ring-white/5"
      style={{
        aspectRatio: tilted ? "16 / 9" : "500 / 470",
        perspective: tilted ? "1500px" : undefined,
      }}
    >
      {/* 3D stage container — only tilts when `tilted=true`. We use `absolute
          inset-0` + a transform on this inner div so the SVG aspect stays
          locked to 500:470 even when rendered into a 16:9 frame. */}
      <div
        className="absolute inset-0"
        style={{
          transform: tilted ? "rotateX(55deg) translateY(8%)" : undefined,
          transformOrigin: "center center",
          transformStyle: "preserve-3d",
        }}
      >
        <svg
          viewBox={`${COURT.X_MIN} ${COURT.Y_MIN} ${COURT.W} ${COURT.H}`}
          preserveAspectRatio="xMidYMid meet"
          className="absolute inset-0 w-full h-full"
        >
          <defs>
            <radialGradient id="rim-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={accent} stopOpacity="0.45" />
              <stop offset="100%" stopColor={accent} stopOpacity="0" />
            </radialGradient>
            {/* Floor wash for tilted mode — brighter near the hoop, fading
                toward the back of the court to sell depth. */}
            <radialGradient id="floor-wash" cx="50%" cy="0%" r="80%">
              <stop offset="0%"  stopColor={accent} stopOpacity={tilted ? "0.18" : "0.10"} />
              <stop offset="80%" stopColor={accent} stopOpacity="0" />
            </radialGradient>
          </defs>

          {tilted && (
            <rect
              x={COURT.X_MIN}
              y={COURT.Y_MIN}
              width={COURT.W}
              height={COURT.H}
              fill="url(#floor-wash)"
            />
          )}

          {/* Soft accent glow behind the rim */}
          <circle cx={COURT.HOOP_X} cy={COURT.HOOP_Y} r={28} fill="url(#rim-glow)" />

          <HalfCourt stroke={tilted ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.22)"} />

          {/* Rim emphasis in accent */}
          <circle cx={COURT.HOOP_X} cy={COURT.HOOP_Y} r={COURT.RIM_R + 0.5} stroke={accent} strokeOpacity={0.9} strokeWidth={2} fill="none" />

          {/* DEBUG overlay — dashed circle at the 3PT arc radius and the
              corner-3 straight lines, in bright magenta. If the official
              arc/lines underneath line up with this overlay, the geometry
              is correct. */}
          {debug && (
            <g stroke="#ff00ff" strokeWidth="1" fill="none" strokeDasharray="4 3" opacity={0.75}>
              <circle cx={0} cy={0} r={COURT.ARC_R} />
              <line x1={-COURT.CORNER_X} y1={COURT.BASELINE_Y} x2={-COURT.CORNER_X} y2={COURT.MIDCOURT_Y} />
              <line x1={ COURT.CORNER_X} y1={COURT.BASELINE_Y} x2={ COURT.CORNER_X} y2={COURT.MIDCOURT_Y} />
            </g>
          )}

          {/* Shots */}
          {shots.map((s, i) => {
            const isSelected = selectedIndex === i;
            const fill = colorFor(s, effectiveMode);
            const r = isSelected ? 9 : 6;
            const stagger = Math.min(0.9, i * 0.003);
            return (
              <motion.circle
                key={i}
                cx={s.x}
                cy={s.y}
                fill={fill}
                stroke="#0a0a0a"
                strokeWidth={1.4}
                opacity={0.85}
                initial={{ r: 0, opacity: 0 }}
                animate={{ r, opacity: 0.85 }}
                transition={{ duration: 0.35, delay: stagger, ease: [0.16, 1, 0.3, 1] }}
                whileHover={{ r: 9, opacity: 1 }}
                style={{ cursor: onSelect ? "pointer" : "default" }}
                onClick={onSelect ? () => onSelect(i) : undefined}
              >
                <title>
                  {`${s.made === 1 ? "MAKE" : "MISS"} · ${isThreePointer(s.x, s.y) ? "3PT" : "2PT"} · xFG ${(s.xfg * 100).toFixed(0)}% · ${shotDistFt(s.x, s.y).toFixed(1)}ft`}
                </title>
              </motion.circle>
            );
          })}
        </svg>
      </div>

      {/* Floor reflection — only when tilted. Mirrors the court, low opacity,
          fades to transparent. Sits behind the main stage in z-space. */}
      {tilted && (
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-[40%] pointer-events-none"
          style={{
            background:
              "linear-gradient(180deg, rgba(0,0,0,0.5) 0%, rgba(0,0,0,1) 100%)",
          }}
        />
      )}

      {/* Legend / HUD */}
      <div className="absolute bottom-3 right-3 flex items-center gap-4 text-[10px] uppercase tracking-[0.18em] text-white/55 bg-black/60 px-3 py-1.5 rounded-md backdrop-blur-sm z-10">
        {effectiveMode === "result" ? (
          <>
            <Swatch color="#34d399" label="Make" />
            <Swatch color="#f87171" label="Miss" />
          </>
        ) : effectiveMode === "residual" ? (
          <>
            <Swatch color="#60a5fa" label="Underperformed" />
            <Swatch color="#f87171" label="Tough make" />
          </>
        ) : (
          <>
            <Swatch color="#22d3ee" label="3PT zone" />
            <Swatch color="#e879f9" label="2PT zone" />
          </>
        )}
      </div>

      {debug && (
        <div className="absolute top-3 left-3 text-[10px] uppercase tracking-[0.22em] text-fuchsia-300 bg-black/60 px-3 py-1.5 rounded-md backdrop-blur-sm z-10">
          Debug ON · magenta = reference arc + corner-3 lines
        </div>
      )}
    </div>
  );
}

function colorFor(s: ShotDatum, mode: "result" | "residual" | "debug"): string {
  if (mode === "debug") {
    return isThreePointer(s.x, s.y) ? "#22d3ee" : "#e879f9";
  }
  if (mode === "result") {
    return s.made === 1 ? "#34d399" : "#f87171";
  }
  const residual = s.made - s.xfg;
  return residual >= 0 ? "#f87171" : "#60a5fa";
}

function Swatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="w-2 h-2 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}
