/**
 * Small pool of curated playoff clips for the /watch demo. Each entry pairs a
 * video URL with the four "What the model saw" inputs the detail card needs,
 * plus the model's expected xFG and the made/missed outcome.
 *
 * URLs follow the NBA's videos.nba.com pbp pattern — same source the main
 * site's clip pool uses. `cors: false` means the frame buffer is tainted and
 * MoveNet won't run; the card still renders, but the tracked metric tiles
 * stay idle until the user uploads their own (CORS-clean) clip.
 */

export type WatchClipInputs = {
  where: string;
  when: string;
  how: string;
  situation: string;
};

export type WatchClip = {
  id: string;
  /** Streaming URL for the <video> tag. */
  url: string;
  /** Short header — e.g. "2026 R1 G7 · BOS vs PHI". */
  series: string;
  /** Display name shown as the card title. */
  player: string;
  /** "1' Running Layup" / "26' Pull-up 3PT" — subtitle under the player. */
  action: string;
  /** Whether the shot fell. Drives the MAKE/MISS pill + result line. */
  made: boolean;
  /** Model's expected FG fraction (0..1). */
  modelXfg: number;
  inputs: WatchClipInputs;
  /** True if the host serves CORS headers; gates pose detection. */
  cors: boolean;
};

export const WATCH_CLIPS: readonly WatchClip[] = [
  {
    id: "edgecombe-g7-layup",
    url: "https://videos.nba.com/nba/pbp/media/2026/04/19/0042500101/13/13b0f724-f604-c30a-5395-a30b3f8f28ee_1280x720.mp4",
    series: "2026 R1 G7 · BOS vs PHI",
    player: "V. Edgecombe",
    action: "1' Running Layup",
    made: true,
    modelXfg: 0.65,
    inputs: {
      where: "1 ft · Restricted Area",
      when: "Q1 · 10:09 · early game",
      how: "Running layup · assisted",
      situation: "Home · clean lane · trailing by 2",
    },
    cors: false,
  },
  {
    id: "suggs-pullup-3",
    url: "https://videos.nba.com/nba/pbp/media/2026/04/19/0042500101/20/3caa8ed1-3269-5729-d0c2-27c5e21e09cf_1280x720.mp4",
    series: "2026 R1 G1 · DET vs ORL",
    player: "J. Suggs",
    action: "26' Pull-up 3PT",
    made: true,
    modelXfg: 0.35,
    inputs: {
      where: "26 ft · Above the Break 3",
      when: "Q1 · 10:34 · early game",
      how: "Pull-up 3PT off the bounce",
      situation: "Home · ~4 ft of space · 3–2",
    },
    cors: false,
  },
  {
    id: "catch-shoot-3",
    url: "https://videos.nba.com/nba/pbp/media/2026/04/19/0042500101/13/13b0f724-f604-c30a-5395-a30b3f8f28ee_1280x720.mp4",
    series: "2026 R1 G3 · BOS vs PHI",
    player: "J. Brown",
    action: "25' Catch-and-Shoot 3PT",
    made: false,
    modelXfg: 0.41,
    inputs: {
      where: "25 ft · Right Wing 3",
      when: "Q3 · 6:42 · clutch window",
      how: "Catch and shoot · off pin-down",
      situation: "Away · ~5 ft of space · tied",
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
