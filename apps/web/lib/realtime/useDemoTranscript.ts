"use client";

import { transcript as seeded } from "@/data/transcript";
import type { TranscriptItem } from "@/types/transcript";
import { useEffect, useRef, useState } from "react";

// Replays the seeded transcript paced by each line's own timestamp, so the UI
// behaves as if captions were arriving live. Used as a fallback when no real
// Supabase session is delivering rows yet — swap in `useLiveTranscript` when
// a backend session is wired through.

const INITIAL_OFFSET_SECONDS = 20 * 60;

const visibleLines: TranscriptItem[] = seeded.filter(
  (l) => l.content.trim() !== "",
);

function timestampToSeconds(ts: string): number {
  const parts = ts.split(":").map((p) => Number.parseInt(p, 10));
  if (parts.some(Number.isNaN)) return 0;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return 0;
}

const INITIAL_COUNT: number = visibleLines.filter(
  (l) => timestampToSeconds(l.timestamp) <= INITIAL_OFFSET_SECONDS,
).length;

export function useDemoTranscript(): {
  lines: TranscriptItem[];
  done: boolean;
} {
  const [count, setCount] = useState(INITIAL_COUNT);
  const startWallMsRef = useRef<number | null>(null);

  useEffect(() => {
    if (count >= visibleLines.length) return;
    startWallMsRef.current ??= Date.now();
    const nextLine = visibleLines[count];
    const nextLectureSec = timestampToSeconds(nextLine.timestamp);
    const targetMs = (nextLectureSec - INITIAL_OFFSET_SECONDS) * 1000;
    const elapsedMs = Date.now() - startWallMsRef.current;
    const delayMs = Math.max(0, targetMs - elapsedMs);
    const id = window.setTimeout(() => setCount((c) => c + 1), delayMs);
    return () => window.clearTimeout(id);
  }, [count]);

  return {
    lines: visibleLines.slice(0, count),
    done: count >= visibleLines.length,
  };
}
