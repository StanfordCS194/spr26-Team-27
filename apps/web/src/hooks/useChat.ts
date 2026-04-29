import { streamQa } from "@/lib/qa";
import type { Message } from "@/types/messages";
import { createContext, use, useCallback, useRef, useState } from "react";

// Chat state lives in memory only — clears on reload or lecture switch.
// Persisting per-lecture (e.g. localStorage) can be layered on later without
// changing this surface.
//
// History is UI-only: every call to `send` issues an *independent* request
// to /api/qa. The server never sees prior turns. Multi-turn would require
// both sending history up and re-templating the server prompt — defer until
// it's actually needed.

// Typewriter knobs: incoming model deltas are buffered, then revealed at a
// steady cadence so wildly variable token sizes don't cause visible
// stutter/fragmentation. Per tick we drain ~1/TARGET_TICKS of the current
// buffer — small buffer reveals slowly, large buffer drains fast so we never
// fall too far behind the stream.
const TYPEWRITER_TICK_MS = 25;
const TYPEWRITER_TARGET_TICKS = 20;

export interface UseChatResult {
  messages: Message[];
  streaming: boolean;
  error: string | null;
  send: (question: string) => void;
}

export function useChat(lectureId: string): UseChatResult {
  const [messages, setMessages] = useState<Message[]>([]);
  const [streaming, setStreaming] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const send = useCallback(
    (question: string): void => {
      const trimmed = question.trim();
      // v1 UX: block new sends while a stream is in flight. Allowing
      // mid-stream interruption is possible (we already track an abort
      // controller) but adds UI states we don't need yet.
      if (!trimmed || streaming) return;

      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      const studentId = crypto.randomUUID();
      const assistantId = crypto.randomUUID();
      setError(null);
      setStreaming(true);
      setMessages((prev) => [
        ...prev,
        { id: studentId, content: trimmed, role: "student", lectureId },
        { id: assistantId, content: "", role: "inLecture", lectureId },
      ]);

      void run(ac.signal, assistantId, trimmed);

      async function run(
        signal: AbortSignal,
        targetId: string,
        q: string,
      ): Promise<void> {
        const buf = { text: "" };
        let streamDone = false;

        // Typewriter: drains buf.text into the assistant message at a steady
        // tick, separately from the (bursty) network delta loop below. Runs
        // in parallel — settles when stream is done AND buffer is empty, or
        // immediately on abort.
        const drain = new Promise<void>((resolve) => {
          const timer = window.setInterval(() => {
            if (signal.aborted) {
              window.clearInterval(timer);
              resolve();
              return;
            }
            if (buf.text.length === 0) {
              if (streamDone) {
                window.clearInterval(timer);
                resolve();
              }
              return;
            }
            const chunkSize = Math.max(
              1,
              Math.ceil(buf.text.length / TYPEWRITER_TARGET_TICKS),
            );
            const chunk = buf.text.slice(0, chunkSize);
            buf.text = buf.text.slice(chunkSize);
            setMessages((prev) =>
              prev.map((m) =>
                m.id === targetId ? { ...m, content: m.content + chunk } : m,
              ),
            );
          }, TYPEWRITER_TICK_MS);
        });

        try {
          // TODO(playback): replace Number.MAX_SAFE_INTEGER with the current
          // video position once a player is wired up. The server filters
          // transcript lines by `timestamp < uptoSeconds`, so this value
          // currently includes the entire transcript.
          for await (const delta of streamQa({
            question: q,
            uptoSeconds: Number.MAX_SAFE_INTEGER,
            signal,
          })) {
            buf.text += delta;
          }
        } catch (err) {
          if (!signal.aborted) {
            setError(err instanceof Error ? err.message : "request failed");
          }
        } finally {
          streamDone = true;
        }

        // Wait for the typewriter to finish revealing whatever's buffered so
        // the input doesn't re-enable mid-display.
        await drain;
        // If we were aborted, a newer send already flipped streaming back
        // on — don't clobber it.
        if (!signal.aborted) setStreaming(false);
      }
    },
    [lectureId, streaming],
  );

  return { messages, streaming, error, send };
}

const ChatCtx = createContext<UseChatResult | null>(null);

export const ChatProvider = ChatCtx.Provider;

export function useChatContext(): UseChatResult {
  const ctx = use(ChatCtx);
  if (!ctx) throw new Error("useChatContext must be used within ChatProvider");
  return ctx;
}
