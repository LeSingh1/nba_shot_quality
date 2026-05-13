/**
 * Clip pool for the /watch demo, built from the real playoff shot record.
 *
 * The previous version hard-coded two clips and shuffle just bounced between
 * them. This version reads `shots_by_game.json` (every shot in every 2025-26
 * playoff game) plus `games.json`, builds a clip per shot, computes the
 * model's xFG for each, and assigns a letter grade.
 *
 * Video URL strategy: NBA's videos.nba.com endpoints require a per-shot UUID
 * we don't have offline. Each shot is paired with one of the curated working
 * clip URLs based on shot type (3PT/jumper → pull-up 3PT clip,
 * paint/layup/dunk → driving-layup clip). The card metadata, mini-court
 * location, and grade come straight from the real shot record.
 */

import type { ShotRecord } from "@/lib/types/shots";
import type { GameMeta, ShotsByGame } from "@/lib/types/shots";
import { xfgForShot } from "@/lib/shotXfg";
import gamesData from "@/lib/data/games.json";
import shotsByGameData from "@/lib/data/shots_by_game.json";

const GAMES = gamesData as GameMeta[];
const SHOTS_BY_GAME = shotsByGameData as ShotsByGame;

// The two NBA video URLs we've verified actually play in browsers. Every
// generated clip falls back to one of these based on shot family.
const FALLBACK_JUMP_SHOT_URL =
  "https://videos.nba.com/nba/pbp/media/2026/04/19/0042500101/20/3caa8ed1-3269-5729-d0c2-27c5e21e09cf_1280x720.mp4";
const FALLBACK_PAINT_URL =
  "https://videos.nba.com/nba/pbp/media/2026/04/19/0042500101/13/13b0f724-f604-c30a-5395-a30b3f8f28ee_1280x720.mp4";

export type WatchClipInputs = {
  where: string;
  when: string;
  how: string;
  situation: string;
};

export type WatchClipMetrics = {
  releaseAngleDeg: number;
  releaseHeightFt: number;
  bodyLeanDeg: number;
  timeToReleaseMs: number;
};

export type WatchClipShotLocation = { x: number; y: number };

/** Letter grade derived from the model's xFG for the shot. */
export type WatchClipGrade = "A+" | "A" | "B" | "C" | "D" | "F";

export type WatchClip = {
  id: string;
  url: string;
  series: string;
  player: string;
  action: string;
  made: boolean;
  modelXfg: number;
  /** Letter grade for this shot's expected quality. */
  grade: WatchClipGrade;
  metrics: WatchClipMetrics;
  inputs: WatchClipInputs;
  shotLocation: WatchClipShotLocation;
  cors: boolean;
};

// ── Helpers ────────────────────────────────────────────────────────────────

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function shortDate(iso: string): string {
  const m = parseInt(iso.slice(5, 7), 10);
  const d = parseInt(iso.slice(8, 10), 10);
  return `${MONTHS[m - 1]} ${d}`;
}

function lastName(full: string): string {
  const parts = full.trim().split(/\s+/);
  const last = parts[parts.length - 1];
  return `${parts[0]?.[0] ?? ""}. ${last}`;
}

function gradeFor(xfg: number): WatchClipGrade {
  if (xfg >= 0.65) return "A+";
  if (xfg >= 0.55) return "A";
  if (xfg >= 0.45) return "B";
  if (xfg >= 0.35) return "C";
  if (xfg >= 0.27) return "D";
  return "F";
}

function pickVideoUrl(s: ShotRecord): string {
  // 3PT and jump shots use the pull-up clip; paint/layup/dunk use the drive.
  if (s.shot_type === "3PT Field Goal") return FALLBACK_JUMP_SHOT_URL;
  if (/Layup|Dunk|Tip|Putback|Cutting|Hook/i.test(s.action_type)) return FALLBACK_PAINT_URL;
  if (/Jump Shot|Pullup|Pull-Up|Step Back|Fadeaway|Turnaround|Floating/i.test(s.action_type)) {
    return FALLBACK_JUMP_SHOT_URL;
  }
  return s.shot_distance >= 16 ? FALLBACK_JUMP_SHOT_URL : FALLBACK_PAINT_URL;
}

function periodLabel(period: number): string {
  if (period <= 4) return `Q${period}`;
  return `OT${period - 4}`;
}

function gameClock(s: ShotRecord): string {
  // seconds_remaining is total seconds within the game; convert to MM:SS of
  // the current quarter using minutes_remaining as the dominant signal.
  const mm = String(s.minutes_remaining).padStart(2, "0");
  const ss = String(Math.max(0, s.seconds_remaining - s.minutes_remaining * 60)).padStart(2, "0");
  return `${mm}:${ss}`;
}

function whenLabel(s: ShotRecord): string {
  return `${periodLabel(s.period)} · ${gameClock(s)}`;
}

function howLabel(s: ShotRecord): string {
  return s.action_type;
}

function whereLabel(s: ShotRecord): string {
  return `${s.shot_distance} ft · ${s.shot_zone}`;
}

function situationLabel(g: GameMeta, s: ShotRecord): string {
  const isHome = s.team_abbrev === g.home_team;
  const venue = isHome ? "Home" : "Away";
  const opp = isHome ? g.away_team : g.home_team;
  return `${venue} vs ${opp}`;
}

// Synthesized release-frame metrics. Real per-shot release angles aren't in
// the shot-chart payload, so these are zone-typical NBA averages — same
// approach the curated clips used.
function metricsFor(s: ShotRecord): WatchClipMetrics {
  if (s.shot_type === "3PT Field Goal") {
    return { releaseAngleDeg: 48, releaseHeightFt: 9.4, bodyLeanDeg: 3, timeToReleaseMs: 410 };
  }
  if (/Layup|Dunk|Putback|Tip|Cutting/i.test(s.action_type)) {
    return { releaseAngleDeg: 38, releaseHeightFt: 9.8, bodyLeanDeg: 8, timeToReleaseMs: 290 };
  }
  if (/Floating|Fadeaway|Turnaround/i.test(s.action_type)) {
    return { releaseAngleDeg: 52, releaseHeightFt: 9.1, bodyLeanDeg: 7, timeToReleaseMs: 480 };
  }
  return { releaseAngleDeg: 46, releaseHeightFt: 9.3, bodyLeanDeg: 4, timeToReleaseMs: 430 };
}

// ── Build the catalog ─────────────────────────────────────────────────────

function buildAllClips(): WatchClip[] {
  const out: WatchClip[] = [];
  const gameById = new Map(GAMES.map((g) => [g.game_id, g]));

  for (const game of GAMES) {
    const shots = SHOTS_BY_GAME[game.game_id] ?? [];
    for (const s of shots) {
      const g = gameById.get(game.game_id);
      if (!g) continue;
      // Skip shots with no useful location (rare malformed rows).
      if (!Number.isFinite(s.x) || !Number.isFinite(s.y)) continue;

      const xfg = xfgForShot(s);
      const round = game.game_id.slice(7, 8); // 0042500{R}{XX}
      out.push({
        id: `${game.game_id}-${s.shot_id}`,
        url: pickVideoUrl(s),
        series: `2026 R${round} · ${g.away_team} @ ${g.home_team} · ${shortDate(g.date)}`,
        player: lastName(s.player_name),
        action: `${s.shot_distance}' ${s.action_type}`,
        made: !!s.made,
        modelXfg: xfg,
        grade: gradeFor(xfg),
        metrics: metricsFor(s),
        inputs: {
          where: whereLabel(s),
          when: whenLabel(s),
          how: howLabel(s),
          situation: situationLabel(g, s),
        },
        shotLocation: { x: s.x, y: s.y },
        cors: false,
      });
    }
  }
  return out;
}

export const WATCH_CLIPS: readonly WatchClip[] = buildAllClips();

export function pickRandomClip(exceptId?: string): WatchClip {
  const pool = exceptId
    ? WATCH_CLIPS.filter((c) => c.id !== exceptId)
    : WATCH_CLIPS;
  return pool[Math.floor(Math.random() * pool.length)] ?? WATCH_CLIPS[0];
}
