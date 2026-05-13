"use client";

import {
  renderWithCitations,
  SourcesTray,
} from "@/components/in-lecture/CitationPills";
import { ToolCallChip } from "@/components/in-lecture/ToolCallChip";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { useChat } from "@/lib/useChat";
import type { Message } from "@/types/messages";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { MdScience, MdSend } from "react-icons/md";

const SAMPLE_PROMPTS: readonly string[] = [
  "What is the central limit theorem?",
  "Explain convolution for summing dice",
  "What was just said?",
];

export function TryRagPanel({ sessionId }: { sessionId: string }) {
  const { messages, streaming, error, send } = useChat(sessionId, sessionId);
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  const submit = () => {
    const trimmed = draft.trim();
    if (!trimmed || streaming) return;
    send(trimmed);
    setDraft("");
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter" || e.shiftKey) return;
    e.preventDefault();
    submit();
  };

  return (
    <Card className="h-full">
      <CardHeader title="Try RAG" right={<span>Instructor preview</span>} />
      <CardBody>
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
              <div className="bg-primary-tint text-primary-accent flex h-12 w-12 items-center justify-center rounded-2xl text-xl">
                <MdScience />
              </div>
              <div className="flex flex-col gap-1.5">
                <p className="text-primary text-sm font-semibold">
                  See what students get
                </p>
                <p className="text-secondary max-w-xs text-xs leading-relaxed">
                  The model decides when to search the transcript or pull
                  recent context. You&apos;ll see each tool call inline.
                </p>
              </div>
              <div className="flex flex-col items-stretch gap-1.5 pt-1">
                {SAMPLE_PROMPTS.map((p) => (
                  <button
                    key={p}
                    onClick={() => send(p)}
                    disabled={streaming}
                    className="border-divider text-primary-accent-dark hover:bg-primary-tint rounded-md border px-3 py-1.5 text-left text-xs transition disabled:opacity-40"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <ul className="flex flex-col gap-3 p-4">
              {messages.map((m) =>
                m.role === "student" ? (
                  <li
                    key={m.id}
                    className="bg-primary-tint text-primary-accent-dark max-w-[85%] self-end rounded-xl px-3 py-2 text-sm font-medium"
                  >
                    {m.content}
                  </li>
                ) : (
                  <AssistantTurn key={m.id} message={m} streaming={streaming} />
                ),
              )}
            </ul>
          )}
        </div>
        <div className="border-divider border-t p-3">
          {error && (
            <p className="pb-2 text-xs text-red-600" role="alert">
              {error}
            </p>
          )}
          <div className="relative">
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKey}
              disabled={streaming}
              placeholder={
                streaming ? "Thinking…" : "Ask a question to test RAG"
              }
              className="focus:outline-primary-accent border-divider bg-primary-bg/40 text-primary w-full rounded-lg border px-3 py-2 pr-10 text-sm disabled:opacity-60"
            />
            <button
              type="button"
              onClick={submit}
              disabled={!draft.trim() || streaming}
              aria-label="Send"
              className="bg-primary-accent hover:bg-primary-accent-dark absolute top-1/2 right-1.5 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-30"
            >
              <MdSend className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

function AssistantTurn({
  message,
  streaming,
}: {
  message: Message;
  streaming: boolean;
}) {
  const tools = message.toolCalls ?? [];
  const cites = message.citations;
  const content = message.content;
  const hasAnything = content.length > 0 || tools.length > 0;

  if (!hasAnything) {
    return streaming ? (
      <li className="text-secondary inline-flex gap-1 px-2 py-1 text-xs">
        <span className="bg-secondary inline-block h-1.5 w-1.5 animate-pulse rounded-full" />
        <span
          className="bg-secondary inline-block h-1.5 w-1.5 animate-pulse rounded-full"
          style={{ animationDelay: "120ms" }}
        />
        <span
          className="bg-secondary inline-block h-1.5 w-1.5 animate-pulse rounded-full"
          style={{ animationDelay: "240ms" }}
        />
      </li>
    ) : null;
  }

  return (
    <li className="flex flex-col gap-2 text-sm">
      {tools.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {tools.map((t) => (
            <ToolCallChip key={t.id} tool={t} />
          ))}
        </div>
      ) : null}
      {content && (
        <p className="text-primary leading-6">
          {renderWithCitations(content, cites)}
        </p>
      )}
      <SourcesTray manifest={cites} />
    </li>
  );
}
