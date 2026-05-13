"use client";

import { streamQa, type CitationManifest } from "@/lib/qa";
import type { Message } from "@/types/messages";
import { useCallback, useRef, useState } from "react";

const TYPEWRITER_TICK_MS = 25;
const TYPEWRITER_TARGET_TICKS = 20;

export interface UseChatResult {
  messages: Message[];
  streaming: boolean;
  error: string | null;
  send: (question: string) => void;
}

export function useChat(lectureId: string, sessionId: string): UseChatResult {
  const [messages, setMessages] = useState<Message[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const send = useCallback(
    (question: string): void => {
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
        {
          id: assistantId,
          content: "",
          role: "inLecture",
          lectureId,
          toolCalls: [],
        },
      ]);

      void run(ac.signal, assistantId, trimmed);

      async function run(
        signal: AbortSignal,
        targetId: string,
        q: string,
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

        let citations: CitationManifest | undefined;
        try {
          for await (const evt of streamQa({
            question: q,
            sessionId,
            signal,
          })) {
            if (evt.type === "delta") {
              buf.text += evt.delta;
            } else if (evt.type === "tool_call") {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === targetId
                    ? {
                        ...m,
                        toolCalls: [...(m.toolCalls ?? []), evt.tool],
                      }
                    : m,
                ),
              );
            } else if (evt.type === "tool_result") {
              setMessages((prev) =>
                prev.map((m) => {
                  if (m.id !== targetId) return m;
                  const next = (m.toolCalls ?? []).map((t) =>
                    t.id === evt.tool.id
                      ? { ...t, resultCount: evt.tool.resultCount }
                      : t,
                  );
                  return { ...m, toolCalls: next };
                }),
              );
            } else if (evt.type === "citations") {
              citations = evt.citations;
            }
          }
        } catch (err) {
          if (!signal.aborted) {
            setError(err instanceof Error ? err.message : "request failed");
          }
        } finally {
          streamDone = true;
        }

        await drain;
        if (citations && !signal.aborted) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === targetId ? { ...m, citations } : m,
            ),
          );
        }
        if (!signal.aborted) setStreaming(false);
      }
    },
    [lectureId, sessionId, streaming],
  );

  return { messages, streaming, error, send };
}
