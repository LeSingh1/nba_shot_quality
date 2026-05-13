"use client";

import { motion } from "motion/react";

/**
 * Inclinometer-style gauge for release angle. Quarter-circle from 0° (flat,
 * right) to 90° (straight up, top). Ideal zone (45–52°) is a subtle band.
 * The needle reads the current value; the big numeric label sits inside the
 * arc and is the focal point.
 */
export function GaugeAngle({
  valueDeg,
  accent = "#FF2D6F",
  size = 200,
}: {
  valueDeg: number;
  accent?: string;
  size?: number;
}) {
  const v = Math.max(0, Math.min(90, valueDeg));
  const cx = size / 2;
  const cy = size * 0.82;
  const r = size * 0.42;

  const valueRad = (v * Math.PI) / 180;
  const needleX = cx + Math.cos(-valueRad) * r;
  const needleY = cy + Math.sin(-valueRad) * r;

  const bgPath = describeArc(cx, cy, r, 0, Math.PI / 2);
  const idealPath = describeArc(cx, cy, r, (45 * Math.PI) / 180, (52 * Math.PI) / 180);
  const valuePath = describeArc(cx, cy, r, 0, valueRad);

  return (
    <svg
      width={size}
      height={size * 0.6}
      viewBox={`0 0 ${size} ${size * 0.6}`}
      role="img"
      aria-label={`Release angle ${Math.round(v)} degrees`}
    >
      {/* Background track */}
      <path
        d={bgPath}
        stroke="rgba(255,255,255,0.10)"
        strokeWidth="5"
        fill="none"
        strokeLinecap="round"
      />

      {/* Ideal zone wedge — subtle band between 45° and 52° */}
      <path
        d={idealPath}
        stroke={accent}
        strokeOpacity="0.35"
        strokeWidth="9"
        fill="none"
        strokeLinecap="butt"
      />

      {/* Filled portion up to current value */}
      {v > 0 && (
        <motion.path
          d={valuePath}
          stroke={accent}
          strokeWidth="5"
          fill="none"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        />
      )}

      {/* Tick marks every 15° for context */}
      {[0, 15, 30, 45, 60, 75, 90].map((t) => {
        const rad = (t * Math.PI) / 180;
        const x1 = cx + Math.cos(-rad) * (r - 8);
        const y1 = cy + Math.sin(-rad) * (r - 8);
        const x2 = cx + Math.cos(-rad) * (r - 2);
        const y2 = cy + Math.sin(-rad) * (r - 2);
        return (
          <line
            key={t}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="rgba(255,255,255,0.25)"
            strokeWidth="1"
          />
        );
      })}

      {/* Needle */}
      <motion.line
        x1={cx}
        y1={cy}
        x2={needleX}
        y2={needleY}
        stroke="#fff"
        strokeWidth="2"
        strokeLinecap="round"
        initial={{ opacity: 0 }}
        animate={{ opacity: v > 0 ? 1 : 0.3 }}
        transition={{ duration: 0.4, delay: 0.2 }}
      />

      {/* Hub */}
      <circle cx={cx} cy={cy} r="3.5" fill="#fff" />

      {/* Big value */}
      <text
        x={cx}
        y={cy - r * 0.45}
        fontSize="34"
        textAnchor="middle"
        fill="#fff"
        fontWeight="900"
        fontFamily="var(--font-display)"
        style={{ letterSpacing: "-0.02em" }}
      >
        {Math.round(v)}°
      </text>
    </svg>
  );
}

function describeArc(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const x0 = cx + r * Math.cos(-a0);
  const y0 = cy + r * Math.sin(-a0);
  const x1 = cx + r * Math.cos(-a1);
  const y1 = cy + r * Math.sin(-a1);
  const large = Math.abs(a1 - a0) > Math.PI ? 1 : 0;
  const sweep = a1 > a0 ? 0 : 1;
  return `M ${x0} ${y0} A ${r} ${r} 0 ${large} ${sweep} ${x1} ${y1}`;
}
