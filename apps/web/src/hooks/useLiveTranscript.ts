import transcript from "@/data/transcript.json";
import type { transcriptItem } from "@/types/transcript";
import { createContext, use, useEffect, useState } from "react";

// Reveals the static transcript one line at a time so the UI animates as if
// captions were arriving live. No server stream involved — this is purely a
// client-side drip over the existing data/transcript.json array. Swap this
// for a real live source later by replacing the body of the effect.

const REVEAL_INTERVAL_MS = 1600;

const visibleLines: transcriptItem[] = transcript.filter(
  (l) => l.content.trim() !== "",
);

export interface UseLiveTranscriptResult {
  lines: transcriptItem[];
  /** true once every line has been revealed */
  done: boolean;
  error: string | null;
}

export function useLiveTranscript(): UseLiveTranscriptResult {
  const [count, setCount] = useState<number>(0);

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
