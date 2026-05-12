"use client";

import dynamic from "next/dynamic";
import type { ShotsMap } from "@/lib/types";
import { Reveal } from "./Reveal";

// Three.js (~600 KB) split out of the initial bundle entirely.
const Laboratory = dynamic(
  () => import("./Laboratory").then((m) => m.Laboratory),
  { ssr: false, loading: () => <div className="h-[600px] bg-[#0a0a0a]" /> },
);

// WatchShot loads TensorFlow lazily inside useMoveNet already, but the
// component itself still pulls in heavy pose-type imports at parse time.
const WatchShot = dynamic(
  () => import("../watch/WatchShot").then((m) => m.WatchShot),
  { ssr: false, loading: () => <div className="h-[400px] bg-[#0a0a0a]" /> },
);

export function HeavySections({
  shots,
}: {
  shots: ShotsMap;
}) {
  return (
    <>
      <div id="watch-a-shot">
        <Reveal><WatchShot shots={shots} /></Reveal>
      </div>
      <Reveal><Laboratory shots={shots} /></Reveal>
    </>
  );
}
