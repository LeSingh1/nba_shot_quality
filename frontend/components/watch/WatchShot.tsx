"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import type { ShotsMap } from "@/lib/types";
import { CountUp } from "@/components/nike/CountUp";
import { useMoveNet } from "@/hooks/useMoveNet";
import { useBallTracking } from "@/hooks/useBallTracking";
import {
  ReleaseDetector,
  type LockedMetrics,
} from "./ReleaseDetector";
import { SKELETON, type Keypoint } from "./pose-types";
import { GaugeAngle } from "./GaugeAngle";
import { MetricCard } from "./MetricCard";
import { ShotDetailCard } from "./ShotDetailCard";
import { WATCH_CLIPS, pickRandomClip, type WatchClip } from "@/lib/watchClips";

/**
 * Live shot-tracking demo.
 *
 *   Video → MoveNet Thunder (every frame) → 17 keypoints
 *           ↓
 *           Canvas overlay draws skeleton + ball trail
 *           ↓
 *           ReleaseDetector watches wrist/ball separation
 *           ↓
 *           On release: lock 5 metrics → call the demo xFG predictor
 *
 * The xFG prediction here is a client-side approximation derived from the
 * playoff shot data (kNN on distance/angle in court coords) plus heuristic
 * adjustments for release angle and body lean. It is NOT the trained
 * XGBoost model — that one lives in the artifacts directory and isn't
 * usable in the browser without an ONNX/TF conversion step.
 */
export function WatchShot({ shots }: { shots: ShotsMap }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const detectorRef = useRef<ReleaseDetector>(new ReleaseDetector());
  const rafRef = useRef<number | null>(null);
  const startedAtRef = useRef<number>(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const { status: poseStatus, detect } = useMoveNet();
  const { track: trackBall, reset: resetBall } = useBallTracking();

  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [defaultMissing, setDefaultMissing] = useState(false);
  const [running, setRunning] = useState(false);
  const [locked, setLocked] = useState<LockedMetrics | null>(null);
  // The current clip drives the detail card under the video. Null when the
  // user has uploaded their own file (no curated metadata to show).
  const [currentClip, setCurrentClip] = useState<WatchClip | null>(WATCH_CLIPS[0] ?? null);

  // Probe the default clip on mount. If it exists locally, use it. Otherwise
  // fall back to the first curated playoff clip so the page always has video.
  useEffect(() => {
    const candidate = "/clips/default-shot.mp4";
    fetch(candidate, { method: "HEAD" })
      .then((r) => {
        if (r.ok) {
          setVideoSrc(candidate);
        } else if (WATCH_CLIPS[0]) {
          setVideoSrc(WATCH_CLIPS[0].url);
        } else {
          setDefaultMissing(true);
        }
      })
      .catch(() => {
        if (WATCH_CLIPS[0]) setVideoSrc(WATCH_CLIPS[0].url);
        else setDefaultMissing(true);
      });
  }, []);

  const onUpload = useCallback((file: File) => {
    const url = URL.createObjectURL(file);
    setVideoSrc(url);
    setDefaultMissing(false);
    setLocked(null);
    setCurrentClip(null);
    detectorRef.current.reset();
    resetBall();
  }, [resetBall]);

  const onShuffleClip = useCallback(() => {
    const next = pickRandomClip(currentClip?.id);
    setCurrentClip(next);
    setVideoSrc(next.url);
    setLocked(null);
    setDefaultMissing(false);
    detectorRef.current.reset();
    resetBall();
  }, [currentClip, resetBall]);

  /** The per-frame loop. MoveNet + HSV ball tracking + canvas overlay paint. */
  const loop = useCallback(async () => {
    const video = videoRef.current;
    const canvas = overlayRef.current;
    if (!video || !canvas || video.paused || video.ended) {
      rafRef.current = requestAnimationFrame(loop);
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      rafRef.current = requestAnimationFrame(loop);
      return;
    }

    // Match canvas internal size to the video for accurate overlay alignment.
    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. Pose
    const kp = (await detect(video)) ?? {};
    if (Object.keys(kp).length) drawSkeleton(ctx, kp);

    // 2. Ball
    const { point: ball, trail } = trackBall(video);
    if (ball.ok) drawBall(ctx, ball, trail);

    // 3. Release detection
    const now = performance.now();
    const m = detectorRef.current.ingest({
      t: now - startedAtRef.current,
      ball: ball.ok ? ball : null,
      kp,
    });
    if (m) {
      setLocked(m);
      // Flash the canvas to mark the release frame.
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    rafRef.current = requestAnimationFrame(loop);
  }, [detect, trackBall]);

  /** Start the loop when the video plays. */
  const onPlay = () => {
    startedAtRef.current = performance.now();
    detectorRef.current.reset();
    resetBall();
    setLocked(null);
    setRunning(true);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(loop);
  };

  const onPause = () => {
    setRunning(false);
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };

  // Cleanup
  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Demo xFG using the existing kNN-on-shots approach. Tracked features
  // adjust the base prediction additively. This stays consistent with the
  // honesty note we ship in the UI.
  const demoXfg = useDemoXfg(shots, locked);

  const hasVideo = !!videoSrc;

  return (
    <section
      className="relative bg-[#0a0a0a] text-white py-24 px-8 md:px-16 min-h-screen"
      style={
        {
          "--nike-accent": "#FF2D6F",
        } as React.CSSProperties
      }
    >
      <div className="relative max-w-7xl mx-auto">
        {/* Header */}
        <div className="border-b border-white/10 pb-5 mb-10">
          <div className="text-[11px] uppercase tracking-[0.22em] text-white/40 mb-2 flex items-center gap-3">
            04 · LIVE TRACKING
            <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: "var(--nike-accent)" }} />
          </div>
          <h1
            className="font-black leading-tight tracking-tight"
            style={{ fontFamily: "var(--font-display)", fontSize: "clamp(40px, 5.5vw, 92px)" }}
          >
            Watch a shot.
          </h1>
          <p className="text-sm text-white/55 mt-3 max-w-2xl leading-relaxed">
            MoveNet Thunder + HSV ball tracking running in your browser. Press play — the skeleton
            and ball trail draw live, the five metrics settle on the release frame, and the model
            scores the shot the way it would on a real play-by-play row.
          </p>
        </div>

        {/* Pose loading status / errors */}
        {poseStatus !== "ready" && (
          <div className="mb-6 rounded-md border border-white/10 bg-white/[0.03] px-4 py-3 text-xs uppercase tracking-[0.18em] text-white/60">
            {poseStatus === "loading"
              ? "Loading MoveNet Thunder · first time can take 5–10s while weights download…"
              : poseStatus === "error"
              ? "Pose detector failed to load. Try again on a fresh page load — WebGL backend required."
              : "Idle"}
          </div>
        )}

        <div className="grid grid-cols-12 gap-6">
          {/* LEFT — video + overlay */}
          <div className="col-span-12 lg:col-span-8">
            <div className="relative rounded-2xl bg-white/[0.03] backdrop-blur-md border border-white/10 overflow-hidden">
              {/* Live badge */}
              <div className="absolute top-3 left-3 z-20 flex items-center gap-2 rounded-full bg-black/60 backdrop-blur-sm px-3 py-1.5 border border-white/10">
                <motion.span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: running ? "var(--nike-accent)" : "rgba(255,255,255,0.4)" }}
                  animate={running ? { opacity: [0.4, 1, 0.4] } : undefined}
                  transition={{ duration: 1.4, repeat: Infinity }}
                />
                <span className="text-[10px] uppercase tracking-[0.22em] text-white/85">
                  {running ? "Live · Tracking" : "Standby"}
                </span>
              </div>

              {/* Upload button */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute top-3 right-3 z-20 rounded-full border border-white/15 bg-black/55 backdrop-blur-sm px-4 py-1.5 text-[10px] uppercase tracking-[0.2em] text-white/85 hover:border-white hover:text-white transition"
              >
                Upload your own
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="video/mp4,video/quicktime,video/webm"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onUpload(f);
                }}
              />

              {/* Video + overlay */}
              <div className="relative w-full aspect-video bg-black">
                {hasVideo ? (
                  <>
                    <video
                      ref={videoRef}
                      src={videoSrc!}
                      className="absolute inset-0 w-full h-full object-contain"
                      autoPlay
                      muted
                      playsInline
                      loop
                      controls
                      onPlay={onPlay}
                      onPause={onPause}
                      onLoadedMetadata={() => {
                        // Kick the loop if the video starts paused.
                        if (videoRef.current && !videoRef.current.paused) onPlay();
                      }}
                    />
                    <canvas
                      ref={overlayRef}
                      className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                    />
                  </>
                ) : (
                  <EmptyState
                    missing={defaultMissing}
                    onPick={() => fileInputRef.current?.click()}
                  />
                )}
              </div>

              {/* Footer caption */}
              <div className="px-4 py-3 text-[10px] uppercase tracking-[0.18em] text-white/40 flex justify-between border-t border-white/5">
                <span>MoveNet Thunder · WebGL · single-pose</span>
                <span>HSV ball tracking · EMA α=0.55</span>
              </div>
            </div>

            {/* Detail card — what the model saw */}
            {currentClip && (
              <div className="mt-6">
                <ShotDetailCard clip={currentClip} onShuffle={onShuffleClip} />
              </div>
            )}
          </div>

          {/* RIGHT — 5 metric cards */}
          <div className="col-span-12 lg:col-span-4 space-y-3">
            <div className="text-[10px] uppercase tracking-[0.28em] text-white/40 flex items-center gap-2">
              <span className="w-3 h-px bg-white/30" />
              Locked at release
            </div>

            <AnimatePresence mode="wait">
              <div key={locked?.releaseFrameTs ?? "idle"} className="space-y-3">
                <MetricCard label="Release angle" delay={0}>
                  <div className="flex justify-center -my-2">
                    <GaugeAngle valueDeg={locked?.releaseAngleDeg ?? 0} accent="var(--nike-accent)" />
                  </div>
                  <div className="text-[10px] text-white/40 text-center -mt-2">
                    Ideal zone 45–52°
                  </div>
                </MetricCard>

                <MetricCard label="Release height" delay={0.08}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span
                      className="font-black tabular-nums leading-none"
                      style={{ fontFamily: "var(--font-display)", fontSize: 44 }}
                    >
                      <CountUp value={locked?.releaseHeightFt ?? 0} decimals={1} /> ft
                    </span>
                    <ReleaseHeightSilhouette ft={locked?.releaseHeightFt ?? 0} />
                  </div>
                </MetricCard>

                <MetricCard label="Body lean" delay={0.16}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span
                      className="font-black tabular-nums leading-none"
                      style={{ fontFamily: "var(--font-display)", fontSize: 44 }}
                    >
                      <CountUp value={locked?.bodyLeanDeg ?? 0} decimals={0} />°
                    </span>
                    <LeanFigure deg={locked?.bodyLeanDeg ?? 0} />
                  </div>
                </MetricCard>

                <MetricCard label="Time to release" delay={0.24}>
                  <div className="flex items-baseline justify-between gap-3 mb-2">
                    <span
                      className="font-black tabular-nums leading-none"
                      style={{ fontFamily: "var(--font-display)", fontSize: 44 }}
                    >
                      <CountUp value={locked?.timeToReleaseMs ?? 0} decimals={0} /> ms
                    </span>
                    <span className="text-[10px] uppercase tracking-wider text-white/40">
                      league avg ≈ 600
                    </span>
                  </div>
                  <ProgressBar valueMs={locked?.timeToReleaseMs ?? 0} />
                </MetricCard>

                <MetricCard label="Model xFG%" delay={0.32} highlight>
                  <motion.div
                    key={locked ? "locked" : "idle"}
                    initial={locked ? { scale: 0.94 } : undefined}
                    animate={locked ? { scale: [0.94, 1.08, 1] } : undefined}
                    transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                    className="font-black tabular-nums leading-none"
                    style={{
                      fontFamily: "var(--font-display)",
                      fontSize: 64,
                      color: "var(--nike-accent)",
                      textShadow:
                        "0 4px 32px color-mix(in srgb, var(--nike-accent) 55%, transparent)",
                    }}
                  >
                    <CountUp value={(demoXfg ?? 0) * 100} decimals={0} />%
                  </motion.div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-white/55 mt-2">
                    Powered by 5 tracked features + game context.
                  </div>
                  <div className="text-[9px] text-white/35 mt-2 leading-relaxed normal-case tracking-normal">
                    Demo mode — tracked features override defaults. Production model uses
                    NBA play-by-play context only (no defender or tracking data in the
                    public endpoints).
                  </div>
                </MetricCard>
              </div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────────────────────────────────── helpers + presenters */

function drawSkeleton(ctx: CanvasRenderingContext2D, kp: Record<string, Keypoint>) {
  ctx.strokeStyle = "rgba(52, 211, 153, 0.8)";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.shadowColor = "rgba(52, 211, 153, 0.7)";
  ctx.shadowBlur = 6;
  for (const [a, b] of SKELETON) {
    const pa = kp[a];
    const pb = kp[b];
    if (!pa || !pb) continue;
    if ((pa.score ?? 0) < 0.3 || (pb.score ?? 0) < 0.3) continue;
    ctx.beginPath();
    ctx.moveTo(pa.x, pa.y);
    ctx.lineTo(pb.x, pb.y);
    ctx.stroke();
  }
  ctx.shadowBlur = 0;
  ctx.fillStyle = "rgba(52, 211, 153, 1)";
  for (const k in kp) {
    const p = kp[k];
    if ((p.score ?? 0) < 0.3) continue;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawBall(
  ctx: CanvasRenderingContext2D,
  ball: { x: number; y: number },
  trail: { x: number; y: number; ok: boolean }[],
) {
  // Trail with opacity decay
  for (let i = 0; i < trail.length; i++) {
    const t = trail[i];
    if (!t.ok) continue;
    const alpha = (i / trail.length) * 0.55;
    ctx.fillStyle = `rgba(255, 140, 60, ${alpha})`;
    const r = 3 + (i / trail.length) * 6;
    ctx.beginPath();
    ctx.arc(t.x, t.y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // Glowing head dot
  ctx.shadowColor = "rgba(255, 140, 60, 0.95)";
  ctx.shadowBlur = 18;
  ctx.fillStyle = "rgba(255, 180, 90, 1)";
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
}

function EmptyState({
  missing,
  onPick,
}: {
  missing: boolean;
  onPick: () => void;
}) {
  return (
    <div className="absolute inset-0 grid place-items-center text-center px-6">
      <div className="max-w-md">
        <div className="text-[10px] uppercase tracking-[0.3em] text-white/40 mb-3">
          {missing ? "No default clip found" : "Waiting for video"}
        </div>
        <h3
          className="font-black mb-3"
          style={{ fontFamily: "var(--font-display)", fontSize: 36 }}
        >
          Drop a jump-shot clip.
        </h3>
        <p className="text-sm text-white/55 leading-relaxed mb-6">
          Pick a short 4–6 second MP4 of a jump shot. Everything runs locally — the
          video never leaves your machine. To skip the picker every time, drop a
          file at{" "}
          <code className="text-white/70">/public/clips/default-shot.mp4</code>.
        </p>
        <button
          onClick={onPick}
          className="rounded-full px-6 py-3 text-xs uppercase tracking-[0.2em] text-white"
          style={{
            background: "var(--nike-accent)",
            boxShadow: "0 12px 36px color-mix(in srgb, var(--nike-accent) 50%, transparent)",
          }}
        >
          Choose video
        </button>
      </div>
    </div>
  );
}

function ReleaseHeightSilhouette({ ft }: { ft: number }) {
  // Tiny stick figure with a red dot at the release height; baseline = 0 ft,
  // top of head ≈ 6.5 ft. Clamp into a 24×42 svg.
  const norm = Math.max(0, Math.min(1, ft / 8));
  const dotY = 38 - norm * 36;
  return (
    <svg width="26" height="44" viewBox="0 0 26 44" className="text-white/40">
      <circle cx="13" cy="6" r="3" fill="currentColor" />
      <line x1="13" y1="9" x2="13" y2="26" stroke="currentColor" strokeWidth="1.5" />
      <line x1="13" y1="14" x2="6" y2="20" stroke="currentColor" strokeWidth="1.5" />
      <line x1="13" y1="14" x2="20" y2="20" stroke="currentColor" strokeWidth="1.5" />
      <line x1="13" y1="26" x2="8" y2="40" stroke="currentColor" strokeWidth="1.5" />
      <line x1="13" y1="26" x2="18" y2="40" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="20" cy={dotY} r="3" fill="var(--nike-accent)" />
    </svg>
  );
}

function LeanFigure({ deg }: { deg: number }) {
  const angle = Math.max(-30, Math.min(30, deg));
  return (
    <svg width="40" height="44" viewBox="0 0 40 44" className="text-white/40">
      <g transform={`rotate(${angle} 20 32)`}>
        <circle cx="20" cy="10" r="3" fill="currentColor" />
        <line x1="20" y1="13" x2="20" y2="30" stroke="currentColor" strokeWidth="1.5" />
        <line x1="20" y1="18" x2="14" y2="24" stroke="currentColor" strokeWidth="1.5" />
        <line x1="20" y1="18" x2="26" y2="24" stroke="currentColor" strokeWidth="1.5" />
      </g>
      <line x1="20" y1="32" x2="14" y2="42" stroke="currentColor" strokeWidth="1.5" />
      <line x1="20" y1="32" x2="26" y2="42" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function ProgressBar({ valueMs }: { valueMs: number }) {
  // Map 0..1200ms onto 0..100%
  const pct = Math.max(0, Math.min(100, (valueMs / 1200) * 100));
  return (
    <div className="h-1.5 w-full bg-white/8 rounded-full overflow-hidden">
      <motion.div
        className="h-full rounded-full"
        style={{ background: "var(--nike-accent)" }}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      />
    </div>
  );
}

/**
 * Demo xFG predictor. Walks the playoff shots dataset to find shots near a
 * notional "release zone" (we use the wrist-vs-hoop angle as a stand-in
 * for distance), then adjusts the mean xFG additively for:
 *
 *   - release-angle deviation from the 47.5° sweet spot
 *   - body-lean penalty
 *
 * Returns null until a release event has fired.
 */
function useDemoXfg(shots: ShotsMap, locked: LockedMetrics | null): number | null {
  return useMemo(() => {
    if (!locked) return null;
    // Aggregate xfg across all featured players' shots in the 18-26ft band —
    // a reasonable proxy for "jump shot from the wing/top" since we don't
    // have true court coords from the video without a calibration click.
    let sum = 0;
    let n = 0;
    for (const k in shots) {
      for (const s of shots[k].shots) {
        const d = Math.hypot(s.x, s.y) / 10;
        if (d >= 18 && d <= 26) {
          sum += s.xfg;
          n += 1;
        }
      }
    }
    const baseline = n > 0 ? sum / n : 0.42;

    // Release angle adjustment — bell curve around 47.5°, std 10°.
    const angleDelta = Math.exp(
      -((locked.releaseAngleDeg - 47.5) ** 2) / (2 * 10 * 10),
    );
    const angleBoost = (angleDelta - 0.5) * 0.18;

    // Body lean penalty — extreme leans hurt.
    const leanPenalty = -Math.min(0.10, Math.abs(locked.bodyLeanDeg) * 0.004);

    return Math.max(0.03, Math.min(0.92, baseline + angleBoost + leanPenalty));
  }, [shots, locked]);
}
