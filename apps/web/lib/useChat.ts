"use client";

import { streamQa } from "@/lib/qa";
import type { Message } from "@/types/messages";
import { useCallback, useRef, useState } from "react";

// Typewriter knobs: incoming model deltas are buffered, then revealed at a
// steady cadence so wildly variable token sizes don't cause visible stutter.
// Per tick we drain ~1/TARGET_TICKS of the buffer.
const TYPEWRITER_TICK_MS = 25;
const TYPEWRITER_TARGET_TICKS = 20;

export interface SendOptions {
  fromSeconds?: number;
  uptoSeconds?: number;
}

export interface UseChatResult {
  messages: Message[];
  streaming: boolean;
  error: string | null;
  send: (question: string, opts?: SendOptions) => void;
}

export function useChat(lectureId: string): UseChatResult {
  const [messages, setMessages] = useState<Message[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const send = useCallback(
    (question: string, opts?: SendOptions): void => {
      const trimmed = question.trim();
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

      void run(ac.signal, assistantId, trimmed, opts);

      async function run(
        signal: AbortSignal,
        targetId: string,
        q: string,
        windowOpts?: SendOptions,
      ): Promise<void> {
        const buf = { text: "" };
        let streamDone = false;

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
          for await (const delta of streamQa({
            question: q,
            uptoSeconds: windowOpts?.uptoSeconds ?? Number.MAX_SAFE_INTEGER,
            fromSeconds: windowOpts?.fromSeconds,
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

        await drain;
        if (!signal.aborted) setStreaming(false);
      }
    },
    [lectureId, streaming],
  );

  return { messages, streaming, error, send };
}
