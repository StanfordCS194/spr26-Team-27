import transcript from "@/data/transcript.json";
import type { transcriptItem } from "@/types/transcript";
import { createContext, use, useEffect, useState } from "react";

// Reveals the static transcript one line at a time so the UI animates as if
// captions were arriving live. No server stream involved — this is purely a
// client-side drip over the existing data/transcript.json array. Swap this
// for a real live source later by replacing the body of the effect.

const REVEAL_INTERVAL_MS = 1600;

// Demo seed: pretend the lecture has already been running for this long when
// the page loads, so the transcript boots in mid-lecture instead of from the
// first second. Set to 0 to start from the beginning.
const INITIAL_OFFSET_SECONDS = 20 * 60;

const visibleLines: transcriptItem[] = transcript.filter(
  (l) => l.content.trim() !== "",
);

function timestampToSeconds(ts: string): number {
  const parts = ts.split(":").map((p) => Number.parseInt(p, 10));
  if (parts.some(Number.isNaN)) return 0;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return 0;
}

// Number of lines already "elapsed" at boot — i.e. all lines whose timestamp
// is at or before INITIAL_OFFSET_SECONDS. The reveal effect picks up after
// this point.
const INITIAL_COUNT: number = visibleLines.filter(
  (l) => timestampToSeconds(l.timestamp) <= INITIAL_OFFSET_SECONDS,
).length;

export interface UseLiveTranscriptResult {
  lines: transcriptItem[];
  /** true once every line has been revealed */
  done: boolean;
  error: string | null;
}

export function useLiveTranscript(): UseLiveTranscriptResult {
  const [count, setCount] = useState<number>(INITIAL_COUNT);

  useEffect(() => {
    if (count >= visibleLines.length) return;
    const id = setTimeout(() => setCount((c) => c + 1), REVEAL_INTERVAL_MS);
    return () => clearTimeout(id);
  }, [count]);

  return {
    lines: visibleLines.slice(0, count),
    done: count >= visibleLines.length,
    error: null,
  };
}

const LiveTranscriptCtx = createContext<UseLiveTranscriptResult | null>(null);

export const LiveTranscriptProvider = LiveTranscriptCtx.Provider;

export function useLiveTranscriptContext(): UseLiveTranscriptResult {
  const ctx = use(LiveTranscriptCtx);
  if (!ctx) {
    throw new Error(
      "useLiveTranscriptContext must be used within LiveTranscriptProvider",
    );
  }
  return ctx;
}
