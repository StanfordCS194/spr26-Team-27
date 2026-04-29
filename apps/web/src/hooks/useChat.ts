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
            setMessages((prev) =>
              prev.map((m) =>
                m.id === targetId ? { ...m, content: m.content + delta } : m,
              ),
            );
          }
        } catch (err) {
          if (signal.aborted) return;
          setError(err instanceof Error ? err.message : "request failed");
        } finally {
          // If we were aborted, a newer send already flipped streaming back
          // on — don't clobber it.
          if (!signal.aborted) setStreaming(false);
        }
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
