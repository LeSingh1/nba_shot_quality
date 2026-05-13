"use client";

import { useMemo, useState } from "react";
import { motion } from "motion/react";
import type { ShotsMap, RankingRow, Shot } from "@/lib/types";
import { FEATURED } from "@/lib/featured";
import { defenderProxyFor } from "@/lib/defenderProxy";
import { TrajectoryReplay } from "../court/TrajectoryReplay";

/**
 * "Every shot, every game" — Player → Game → Shot drill-down with an
 * animated trajectory replay in the right panel.
 *
 * Each shot now carries GAME_ID, GAME_DATE, PERIOD, MINUTES_REMAINING,
 * SECONDS_REMAINING from the NBA shotchartdetail feed (see the export
 * script). We bucket by real GAME_ID, sort games chronologically, sort
 * shots within a game chronologically (period asc; clock asc-elapsed,
 * which means minutes/seconds *remaining* desc).
 */

type ShotPoint = Shot;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatGameDate(yyyymmdd?: string): string {
  if (!yyyymmdd || yyyymmdd.length !== 8) return "";
  const m = parseInt(yyyymmdd.slice(4, 6), 10);
  const d = parseInt(yyyymmdd.slice(6, 8), 10);
  if (!m || !d) return "";
  return `${MONTHS[m - 1]} ${d}`;
}

function periodLabel(p?: number): string {
  if (!p) return "";
  if (p <= 4) return `Q${p}`;
  return `OT${p - 4}`;
}

function clockLabel(min?: number, sec?: number): string {
  if (min === undefined || sec === undefined) return "";
  return `${min}:${String(sec).padStart(2, "0")}`;
}

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
  const [query, setQuery] = useState("");

  // Every player with playoff shots, sorted by volume. Searchable.
  const allPlayers = useMemo(() => {
    return [...ranking]
      .filter((r) => r.n_shots > 0 && shots[String(r.player_id)]?.shots?.length)
      .sort((a, b) => b.n_shots - a.n_shots);
  }, [ranking, shots]);

  const players = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allPlayers.slice(0, 60);
    return allPlayers.filter((p) => p.player_name.toLowerCase().includes(q)).slice(0, 60);
  }, [allPlayers, query]);

  const playerName = ranking.find((r) => r.player_id === playerId)?.player_name ?? "—";
  const allShots: ShotPoint[] = shots[String(playerId)]?.shots ?? [];

  // Bucket shots by real GAME_ID. Sort games chronologically by date.
  // Within a game, the export already sorted shots by (period asc, clock
  // ascending-elapsed), so we preserve that order.
  const games = useMemo(() => {
    const byGame = new Map<string, ShotPoint[]>();
    for (const s of allShots) {
      const key = s.game ?? "unknown";
      if (!byGame.has(key)) byGame.set(key, []);
      byGame.get(key)!.push(s);
    }
    const list = [...byGame.entries()].map(([gameId, gShots]) => {
      const made = gShots.filter((s) => s.made === 1).length;
      const xfg = gShots.reduce((a, s) => a + s.xfg, 0) / Math.max(1, gShots.length);
      const date = gShots[0]?.date ?? "";
      const opp = gShots[0]?.opp ?? "";
      const home = gShots[0]?.home ?? 0;
      return { gameId, date, opp, home, shots: gShots, made, xfg };
    });
    list.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.gameId.localeCompare(b.gameId)));
    // Series-game numbering: counter resets each time the opponent changes,
    // so a player who wins a 7-game R1 then opens R2 sees "Game 7 vs ORL"
    // followed by "Game 1 @ CLE" rather than a cumulative "Game 08".
    let seriesNum = 0;
    let prevOpp: string | null = null;
    return list.map((g, idx) => {
      if (g.opp !== prevOpp) {
        seriesNum = 1;
        prevOpp = g.opp;
      } else {
        seriesNum += 1;
      }
      return { idx, seriesNum, ...g };
    });
  }, [allShots]);

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
              gameNum={currentGame?.seriesNum ?? null}
              gameLabel={currentGame ? `${currentGame.home ? "vs" : "@"} ${currentGame.opp}` : null}
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
          <Column
            title={`Player · ${allPlayers.length}`}
            header={
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search…"
                className="w-full mb-1 px-2 py-1.5 text-xs rounded bg-white/[0.04] ring-1 ring-white/10 placeholder:text-white/30 outline-none focus:ring-white/30 transition"
              />
            }
          >
            {players.length === 0 && (
              <div className="text-xs text-white/35 px-3 py-3">No players match.</div>
            )}
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

          <Column title={`Game · ${games.length}`}>
            {games.length === 0 && (
              <div className="text-xs text-white/35 px-3 py-6">Pick a player to see games.</div>
            )}
            {games.map((g) => (
              <RailRow
                key={g.gameId}
                active={g.idx === gameIdx}
                onClick={() => {
                  setGameIdx(g.idx);
                  setShotIdx(null);
                }}
                primary="#FF2D6F"
              >
                <span className="font-medium flex flex-col items-start min-w-0">
                  <span>
                    Game {g.seriesNum}
                    {g.opp && (
                      <span className="ml-1.5 text-white/55 text-[10px] font-mono">
                        {g.home ? "vs" : "@"} {g.opp}
                      </span>
                    )}
                  </span>
                  <span className="text-[9px] text-white/40 font-mono normal-case tracking-normal">
                    {formatGameDate(g.date)}
                  </span>
                </span>
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
              const pq = periodLabel(s.p);
              const clk = clockLabel(s.min, s.sec);
              return (
                <RailRow
                  key={i}
                  active={i === shotIdx}
                  onClick={() => setShotIdx(i)}
                  primary={isMake ? "rgb(120,255,180)" : "rgb(255,100,116)"}
                >
                  <span className="font-medium flex flex-col items-start min-w-0">
                    <span className="flex items-center gap-2">
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ background: isMake ? "rgb(120,255,180)" : "rgb(255,100,116)" }}
                      />
                      Shot {String(i + 1).padStart(2, "0")}
                    </span>
                    {(pq || clk) && (
                      <span className="text-[9px] text-white/45 font-mono pl-3.5">
                        {pq} {clk && `· ${clk}`}
                      </span>
                    )}
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
                  {(currentShot.p !== undefined || currentShot.min !== undefined) && (
                    <>
                      {" · "}
                      {periodLabel(currentShot.p)} {clockLabel(currentShot.min, currentShot.sec)}
                    </>
                  )}
                </span>
              )}
            </div>
            <TrajectoryReplay shot={currentShot} playerName={playerName} tilted />

            {/* Shot-detail strip — surfaces every metric the NBA feed
                ships per attempt. Defender distance and shot-clock are
                NOT in shotchartdetail (NBA only releases those via
                Synergy / tracking endpoints we don't ingest), so they're
                marked N/A rather than fabricated. */}
            {currentShot && (
              <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-px bg-white/[0.05] rounded-md overflow-hidden ring-1 ring-white/10">
                <DetailCell label="Action" value={currentShot.action ?? "—"} />
                <DetailCell label="Zone" value={currentShot.zone ?? "—"} />
                <DetailCell label="Range" value={currentShot.range ?? "—"} />
                <DetailCell
                  label="Distance"
                  value={`${currentShot.dist ?? Math.round(Math.hypot(currentShot.x, currentShot.y) / 10)} ft`}
                />
                <DetailCell label="Shot type" value={currentShot.is3 ? "3PT" : "2PT"} />
                <DetailCell label="Area" value={currentShot.area ?? "—"} />
                {(() => {
                  const def = defenderProxyFor(currentShot.action);
                  return (
                    <DetailCell
                      label="Defender dist."
                      value={`~${def.ft.toFixed(1)} ft`}
                      hint={`${def.bucket} · proxy from action`}
                    />
                  );
                })()}
                <DetailCell
                  label="Shot clock"
                  value="N/A"
                  hint="not in shotchartdetail"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function Breadcrumb({
  playerName, gameNum, gameLabel, shotIdx,
}: { playerName: string; gameNum: number | null; gameLabel: string | null; shotIdx: number | null }) {
  return (
    <span className="text-white/45 font-mono text-[10px] tracking-normal normal-case">
      {playerName}
      {gameNum !== null && (
        <>
          {" "}<span className="text-white/25">›</span>{" "}
          Game {gameNum}
          {gameLabel && <span className="text-white/35"> {gameLabel}</span>}
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

function DetailCell({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="bg-[#1a1a1a] px-3 py-2.5 min-w-0">
      <div className="text-[9px] uppercase tracking-[0.18em] text-white/40 mb-0.5">
        {label}
      </div>
      <div className="text-xs text-white/90 font-medium truncate" title={value}>
        {value}
      </div>
      {hint && (
        <div className="text-[8px] uppercase tracking-wider text-white/25 mt-0.5">
          {hint}
        </div>
      )}
    </div>
  );
}

function Column({
  title,
  children,
  header,
}: {
  title: string;
  children: React.ReactNode;
  header?: React.ReactNode;
}) {
  return (
    <div className="col-span-12 md:col-span-2">
      <div className="text-[11px] uppercase tracking-[0.2em] text-white/40 mb-3 px-1">{title}</div>
      {header && <div className="mb-2 px-1">{header}</div>}
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
