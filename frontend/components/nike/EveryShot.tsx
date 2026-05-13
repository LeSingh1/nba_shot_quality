"use client";

import { useMemo, useState } from "react";
import { motion } from "motion/react";
import type { ShotsMap, RankingRow } from "@/lib/types";
import { FEATURED } from "@/lib/featured";
import { TrajectoryReplay } from "../court/TrajectoryReplay";

/**
 * "Every shot, every game" — Player → Game → Shot drill-down with an
 * animated trajectory replay in the right panel.
 *
 * Data caveat: the export doesn't carry game_id per shot, so we synthesize
 * "games" by bucketing each player's shots into chunks of ~SHOTS_PER_GAME.
 * The bucket index becomes a fake game number. This loses true game grouping
 * but reads correctly for the demo's narrative purpose.
 */

const SHOTS_PER_GAME = 12;

// 2025-26 NBA Playoffs — first round tips April 18, Finals wrap mid-June.
// Each player gets a deterministic per-player schedule: their team's seed
// dictates which of the first 7 days they tip off, and the gap between games
// alternates 2/3 days (with a 4-5 day break between rounds at games 5 and 9
// to simulate round transitions).
const PLAYOFF_TIPOFF = new Date(Date.UTC(2026, 3, 18)); // April 18, 2026
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function ordinal(n: number): string {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
}

// Deterministic 0..1 from any integer — keeps SSR stable.
function seeded(x: number, salt: number): number {
  const v = Math.sin(x * 12.9898 + salt * 78.233) * 43758.5453;
  return Math.abs(v - Math.floor(v));
}

/**
 * Build the playoff calendar for a player, deterministic from playerId.
 *   - Series opener offset 0-6 days into the first week
 *   - Within-series gap: 2 or 3 days (the home/road back-to-back pattern)
 *   - Between-round break of 4-5 days after game 4 and game 9
 */
function buildSchedule(playerId: number, gameCount: number): Date[] {
  const startOffset = Math.floor(seeded(playerId, 1) * 7); // 0-6 days
  const start = new Date(PLAYOFF_TIPOFF);
  start.setUTCDate(start.getUTCDate() + startOffset);

  const dates: Date[] = [new Date(start)];
  const cursor = new Date(start);
  for (let i = 1; i < gameCount; i++) {
    let gap = seeded(playerId, i + 2) < 0.5 ? 2 : 3;
    if (i === 4 || i === 9) gap = 4 + Math.round(seeded(playerId, i + 5)); // 4-5 day round break
    cursor.setUTCDate(cursor.getUTCDate() + gap);
    dates.push(new Date(cursor));
  }
  return dates;
}

function formatPlayoffDate(d: Date): string {
  return `${MONTH_NAMES[d.getUTCMonth()]} ${ordinal(d.getUTCDate())}`;
}

type ShotPoint = { x: number; y: number; made: 0 | 1; xfg: number };

export function EveryShot({
  shots,
  ranking,
}: {
  shots: ShotsMap;
  ranking: RankingRow[];
}) {
  const [playerId, setPlayerId] = useState<number>(FEATURED[0].id);
  const [gameIdx, setGameIdx] = useState<number>(0);
  const [shotIdx, setShotIdx] = useState<number | null>(null);

  // Featured + top-volume roster shown in the left rail, sorted by shot count.
  const players = useMemo(() => {
    return [...ranking]
      .filter((r) => r.n_shots >= 30)
      .sort((a, b) => b.n_shots - a.n_shots)
      .slice(0, 18);
  }, [ranking]);

  const playerName = ranking.find((r) => r.player_id === playerId)?.player_name ?? "—";
  const allShots: ShotPoint[] = shots[String(playerId)]?.shots ?? [];

  // Bucket shots into games. Each game gets a number and a derived stat line.
  const games = useMemo(() => {
    const out: { idx: number; shots: ShotPoint[]; made: number; xfg: number }[] = [];
    for (let i = 0; i < allShots.length; i += SHOTS_PER_GAME) {
      const slice = allShots.slice(i, i + SHOTS_PER_GAME);
      const made = slice.filter((s) => s.made === 1).length;
      const xfg = slice.reduce((a, s) => a + s.xfg, 0) / Math.max(1, slice.length);
      out.push({ idx: out.length, shots: slice, made, xfg });
    }
    return out;
  }, [allShots]);

  // Per-player playoff calendar — same playerId always produces the same dates.
  const schedule = useMemo(
    () => buildSchedule(playerId, games.length),
    [playerId, games.length],
  );

  const currentGame = games[gameIdx];
  const currentShot = shotIdx !== null ? currentGame?.shots[shotIdx] ?? null : null;

  return (
    <section id="every-shot" className="relative bg-[#1a1a1a] text-white py-24 px-8 md:px-16 overflow-hidden">
      <div className="relative max-w-7xl mx-auto">
        <div className="border-b border-white/10 pb-5 mb-10">
          <div className="text-[11px] uppercase tracking-[0.22em] text-white/40 mb-2 flex items-center gap-3">
            03 · Drill down
            <Breadcrumb
              playerName={playerName}
              gameLabel={currentGame && schedule[currentGame.idx] ? formatPlayoffDate(schedule[currentGame.idx]) : null}
              shotIdx={shotIdx}
            />
          </div>
          <h2 className="font-bold leading-tight" style={{ fontFamily: "var(--font-display)", fontSize: "clamp(36px,4.5vw,72px)" }}>
            Every shot, every game.
          </h2>
          <p className="text-sm text-white/55 mt-3 max-w-2xl">
            Walk all the way from a player&apos;s playoff run down to a single attempt. The right panel
            replays the shot — a parabolic arc fired from the floor, with the model&apos;s xFG sitting
            on the rim like a price tag.
          </p>
        </div>

        <div className="grid grid-cols-12 gap-6">
          <Column title={`Player · ${players.length}`}>
            {players.map((p) => (
              <RailRow
                key={p.player_id}
                active={p.player_id === playerId}
                onClick={() => {
                  setPlayerId(p.player_id);
                  setGameIdx(0);
                  setShotIdx(null);
                }}
                primary="#FF2D6F"
              >
                <span className="font-medium truncate">{p.player_name}</span>
                <span className="ml-2 text-[10px] uppercase tracking-wider text-white/35 font-mono shrink-0">
                  {p.n_shots}
                </span>
              </RailRow>
            ))}
          </Column>

          <Column title={`Playoff game · ${games.length}`}>
            {games.length === 0 && (
              <div className="text-xs text-white/35 px-3 py-6">Pick a player to see games.</div>
            )}
            {games.map((g) => (
              <RailRow
                key={g.idx}
                active={g.idx === gameIdx}
                onClick={() => {
                  setGameIdx(g.idx);
                  setShotIdx(null);
                }}
                primary="#FF2D6F"
              >
                <span className="font-medium">{schedule[g.idx] ? formatPlayoffDate(schedule[g.idx]) : "—"}</span>
                <span className="ml-2 flex gap-1.5 items-center text-[10px] uppercase tracking-wider font-mono">
                  <span className="text-white/55">{g.made}/{g.shots.length}</span>
                  <span className="text-white/30">·</span>
                  <span className="text-white/55">{Math.round(g.xfg * 100)}xfg</span>
                </span>
              </RailRow>
            ))}
          </Column>

          <Column title={`Shot · ${currentGame?.shots.length ?? 0}`}>
            {!currentGame && (
              <div className="text-xs text-white/35 px-3 py-6">Pick a game to see shots.</div>
            )}
            {currentGame?.shots.map((s, i) => {
              const isMake = s.made === 1;
              const dist = (Math.hypot(s.x, s.y) / 10).toFixed(0);
              return (
                <RailRow
                  key={i}
                  active={i === shotIdx}
                  onClick={() => setShotIdx(i)}
                  primary={isMake ? "rgb(120,255,180)" : "rgb(255,100,116)"}
                >
                  <span className="font-medium flex items-center gap-2">
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ background: isMake ? "rgb(120,255,180)" : "rgb(255,100,116)" }}
                    />
                    Shot {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="ml-2 text-[10px] uppercase tracking-wider text-white/45 font-mono">
                    {dist}ft · {Math.round(s.xfg * 100)}%
                  </span>
                </RailRow>
              );
            })}
          </Column>

          {/* Trajectory replay panel */}
          <div className="col-span-12 md:col-span-6">
            <div className="text-[11px] uppercase tracking-[0.2em] text-white/40 mb-3 flex items-center gap-3">
              <span>Trajectory replay</span>
              {currentShot && (
                <span className="text-white/30">
                  {currentShot.made ? "MAKE" : "MISS"} ·{" "}
                  {(Math.hypot(currentShot.x, currentShot.y) / 10).toFixed(1)} ft
                </span>
              )}
            </div>
            <TrajectoryReplay shot={currentShot} playerName={playerName} />
          </div>
        </div>
      </div>
    </section>
  );
}

function Breadcrumb({
  playerName, gameLabel, shotIdx,
}: { playerName: string; gameLabel: string | null; shotIdx: number | null }) {
  return (
    <span className="text-white/45 font-mono text-[10px] tracking-normal normal-case">
      {playerName}
      {gameLabel && (
        <>
          {" "}<span className="text-white/25">›</span>{" "}
          {gameLabel}
        </>
      )}
      {shotIdx !== null && (
        <>
          {" "}<span className="text-white/25">›</span>{" "}
          Shot {String(shotIdx + 1).padStart(2, "0")}
        </>
      )}
    </span>
  );
}

function Column({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="col-span-12 md:col-span-2">
      <div className="text-[11px] uppercase tracking-[0.2em] text-white/40 mb-3 px-1">{title}</div>
      <div className="h-[420px] overflow-y-auto pr-1 space-y-0.5 rounded-md bg-white/[0.02] ring-1 ring-white/5 p-1">
        {children}
      </div>
    </div>
  );
}

function RailRow({
  active, onClick, children, primary,
}: { active: boolean; onClick: () => void; children: React.ReactNode; primary: string }) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ x: 2 }}
      transition={{ type: "spring", stiffness: 280, damping: 24 }}
      className="relative w-full flex items-center justify-between text-left px-3 py-2 rounded-md text-xs transition group"
      style={{ background: active ? "rgba(255,255,255,0.06)" : "transparent" }}
    >
      {active && (
        <motion.span
          layoutId={`rail-${primary}`}
          className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r"
          style={{ background: primary }}
          transition={{ type: "spring", stiffness: 280, damping: 28 }}
        />
      )}
      <span className="text-white/80 group-hover:text-white pl-2 flex items-center min-w-0 flex-1">
        {children}
      </span>
    </motion.button>
  );
}
