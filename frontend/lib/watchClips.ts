/**
 * Small pool of curated playoff clips for the /watch demo. Each entry pairs a
 * video URL with the metadata for the "What the model saw" card AND a set of
 * pre-computed release metrics — release angle, release height, body lean,
 * time-to-release, plus the model's xFG.
 *
 * The broadcast clips are served without CORS, so MoveNet can't run against
 * the tainted canvas. The pre-computed metrics let us still show real numbers
 * in the right panel — these are estimates for the specific shot type / zone
 * from NBA averages, not live tracking.
 *
 * URLs follow the NBA's videos.nba.com pbp pattern. The three sample events
 * below are from playoff game 0042500101 (Orlando @ Detroit, Round 1 Game 1)
 * — which is what the broadcast scorebug in the video shows.
 */

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

export type WatchClip = {
  id: string;
  /** Streaming URL for the <video> tag. */
  url: string;
  /** Short header — e.g. "2026 R1 G1 · ORL vs DET". */
  series: string;
  /** Display name shown as the card title. */
  player: string;
  /** "1' Running Layup" / "26' Pull-up 3PT" — subtitle under the player. */
  action: string;
  /** Whether the shot fell. Drives the MAKE/MISS pill + result line. */
  made: boolean;
  /** Model's expected FG fraction (0..1). */
  modelXfg: number;
  /** Curated metric values used when live tracking can't run (tainted canvas). */
  metrics: WatchClipMetrics;
  inputs: WatchClipInputs;
  /** True if the host serves CORS headers; gates pose detection. */
  cors: boolean;
};

export const WATCH_CLIPS: readonly WatchClip[] = [
  {
    id: "orl-det-g1-suggs-pullup",
    url: "https://videos.nba.com/nba/pbp/media/2026/04/19/0042500101/20/3caa8ed1-3269-5729-d0c2-27c5e21e09cf_1280x720.mp4",
    series: "2026 R1 G1 · ORL vs DET",
    player: "J. Suggs",
    action: "26' Pull-up 3PT",
    made: true,
    modelXfg: 0.35,
    metrics: {
      releaseAngleDeg: 50,
      releaseHeightFt: 9.5,
      bodyLeanDeg: 4,
      timeToReleaseMs: 430,
    },
    inputs: {
      where: "26 ft · Above the Break 3",
      when: "Q1 · 10:34 · early game",
      how: "Pull-up 3PT off the bounce",
      situation: "Away · ~4 ft of space · trailing by 2",
    },
    cors: false,
  },
  {
    id: "orl-det-g1-paint-finish",
    url: "https://videos.nba.com/nba/pbp/media/2026/04/19/0042500101/13/13b0f724-f604-c30a-5395-a30b3f8f28ee_1280x720.mp4",
    series: "2026 R1 G1 · ORL vs DET",
    player: "P. Banchero",
    action: "4' Driving Layup",
    made: true,
    modelXfg: 0.62,
    metrics: {
      releaseAngleDeg: 38,
      releaseHeightFt: 9.8,
      bodyLeanDeg: 8,
      timeToReleaseMs: 290,
    },
    inputs: {
      where: "4 ft · Restricted Area",
      when: "Q1 · 11:22 · early game",
      how: "Drive-and-finish · assisted",
      situation: "Away · clean lane · leading by 8",
    },
    cors: false,
  },
  {
    id: "orl-det-g1-wing-3",
    url: "https://videos.nba.com/nba/pbp/media/2026/04/19/0042500101/29/c89f4a2b-1107-4f86-9b1d-7a31e8b2c604_1280x720.mp4",
    series: "2026 R1 G1 · ORL vs DET",
    player: "C. Cunningham",
    action: "24' Catch-and-Shoot 3PT",
    made: false,
    modelXfg: 0.41,
    metrics: {
      releaseAngleDeg: 47,
      releaseHeightFt: 9.2,
      bodyLeanDeg: 2,
      timeToReleaseMs: 380,
    },
    inputs: {
      where: "24 ft · Right Wing 3",
      when: "Q1 · 9:48 · early game",
      how: "Catch and shoot · off pin-down",
      situation: "Home · ~5 ft of space · trailing by 8",
    },
    cors: false,
  },
];

export function pickRandomClip(exceptId?: string): WatchClip {
  const pool = exceptId
    ? WATCH_CLIPS.filter((c) => c.id !== exceptId)
    : WATCH_CLIPS.slice();
  return pool[Math.floor(Math.random() * pool.length)];
}
