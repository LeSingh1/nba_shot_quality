"use client";

import { motion } from "motion/react";

/**
 * Semicircular gauge with a thin needle indicating the release angle.
 * Ideal zone (45–52°) is filled with the accent color at low opacity so the
 * eye reads it as the "good shot" wedge.
 *
 * Gauge sweeps from 0° at the right (3 o'clock) to 90° at the top (12 o'clock).
 * We map the value linearly into that quarter-circle so visually it reads like
 * an inclinometer.
 */
export function GaugeAngle({
  valueDeg,
  accent = "#FF2D6F",
  size = 180,
}: {
  valueDeg: number;
  accent?: string;
  size?: number;
}) {
  const v = Math.max(0, Math.min(90, valueDeg));
  const cx = size / 2;
  const cy = size * 0.78;
  const r = size * 0.42;

  // Convert 0..90° to SVG end-angle (we draw counter-clockwise from 0° at 3 o'clock).
  const valueRad = (v * Math.PI) / 180;
  const needleX = cx + Math.cos(-valueRad) * r;
  const needleY = cy + Math.sin(-valueRad) * r;

  const idealStart = (45 * Math.PI) / 180;
  const idealEnd = (52 * Math.PI) / 180;
  const idealPath = describeArc(cx, cy, r * 0.88, idealStart, idealEnd);

  // Background arc
  const bgPath = describeArc(cx, cy, r, 0, Math.PI / 2);

  return (
    <svg width={size} height={size * 0.82} viewBox={`0 0 ${size} ${size * 0.82}`}>
      <defs>
        <linearGradient id="gauge-sweep" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%"  stopColor={accent} stopOpacity="0.3" />
          <stop offset="100%" stopColor={accent} stopOpacity="0.9" />
        </linearGradient>
      </defs>

      {/* Background track */}
      <path d={bgPath} stroke="rgba(255,255,255,0.08)" strokeWidth="8" fill="none" strokeLinecap="round" />

      {/* Ideal wedge */}
      <path d={idealPath} stroke={accent} strokeWidth="14" strokeOpacity="0.28" fill="none" strokeLinecap="butt" />

      {/* Filled portion up to the current value */}
      <motion.path
        d={describeArc(cx, cy, r, 0, valueRad)}
        stroke="url(#gauge-sweep)"
        strokeWidth="8"
        fill="none"
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      />

      {/* Needle */}
      <motion.line
        x1={cx}
        y1={cy}
        x2={needleX}
        y2={needleY}
        stroke="#fff"
        strokeWidth="2.5"
        strokeLinecap="round"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.3 }}
      />
      {/* Hub */}
      <circle cx={cx} cy={cy} r="5" fill="#fff" />
      <circle cx={cx} cy={cy} r="2" fill={accent} />

      {/* Tick labels */}
      <text x={cx - r - 4} y={cy + 4} fontSize="9" textAnchor="end" fill="rgba(255,255,255,0.4)" fontFamily="var(--font-mono)">0°</text>
      <text x={cx} y={cy - r - 6} fontSize="9" textAnchor="middle" fill="rgba(255,255,255,0.4)" fontFamily="var(--font-mono)">90°</text>
      <text x={cx + r + 4} y={cy + 4} fontSize="9" textAnchor="start" fill="rgba(255,255,255,0.4)" fontFamily="var(--font-mono)">—</text>

      {/* Value label */}
      <text x={cx + r * 0.42} y={cy - 6} fontSize="22" textAnchor="middle" fill="#fff" fontWeight="900" fontFamily="var(--font-display)">
        {Math.round(v)}°
      </text>
    </svg>
  );
}

function describeArc(cx: number, cy: number, r: number, a0: number, a1: number): string {
  // angles measured counter-clockwise from +x axis (3 o'clock).
  // SVG y grows downward → invert sin().
  const x0 = cx + r * Math.cos(-a0);
  const y0 = cy + r * Math.sin(-a0);
  const x1 = cx + r * Math.cos(-a1);
  const y1 = cy + r * Math.sin(-a1);
  const large = Math.abs(a1 - a0) > Math.PI ? 1 : 0;
  const sweep = a1 > a0 ? 0 : 1; // sweep "up" the page (counter-clockwise)
  return `M ${x0} ${y0} A ${r} ${r} 0 ${large} ${sweep} ${x1} ${y1}`;
}
