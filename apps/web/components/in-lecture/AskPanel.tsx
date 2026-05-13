"use client";

import {
  renderWithCitations,
  SourcesTray,
} from "@/components/in-lecture/CitationPills";
import { EmptyState } from "@/components/in-lecture/EmptyState";
import { ToolCallChip } from "@/components/in-lecture/ToolCallChip";
import { lectureById } from "@/data/lectures";
import { useChat } from "@/lib/useChat";
import type { Message } from "@/types/messages";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import {
  MdAccessTime,
  MdBolt,
  MdChatBubbleOutline,
  MdExpandMore,
  MdSchedule,
  MdSend,
} from "react-icons/md";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";

const QUICK_PROMPTS: readonly string[] = [
  "Re-explain that",
  "Give an example",
  "What just happened?",
];

interface DeferredQuestion {
  id: string;
  content: string;
}

export default function AskPanel() {
  const { lectureId } = useParams<{ lectureId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const q = searchParams.get("q") ?? "";

  const lecture = lectureId ? lectureById(lectureId) : undefined;
  const sessionId = lecture?.sessionId ?? "";
  const { messages, streaming, error, send } = useChat(
    lectureId ?? "demo",
    sessionId,
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [draft, setDraft] = useState<string>(q);
  const [prevQ, setPrevQ] = useState<string>(q);
  if (q !== prevQ) {
    setPrevQ(q);
    if (q) setDraft(q);
  }

  useEffect(() => {
    if (q) inputRef.current?.focus();
  }, [q]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  const [deferMode, setDeferMode] = useState(false);
  const [deferred, setDeferred] = useState<DeferredQuestion[]>([]);

  const trimmed = draft.trim();
  const canSend = trimmed.length > 0 && !streaming;

  const clearDraft = () => {
    setDraft("");
    if (q) {
      const next = new URLSearchParams(searchParams.toString());
      next.delete("q");
      const qs = next.toString();
      router.replace(qs ? `?${qs}` : "?", { scroll: false });
    }
  };

  const submit = () => {
    if (!canSend) return;
    if (deferMode) {
      setDeferred((prev) => [
        ...prev,
        { id: crypto.randomUUID(), content: trimmed },
      ]);
      clearDraft();
      return;
    }
    send(trimmed);
    clearDraft();
  };

  // Quick prompts no longer carry a hand-picked window — the model decides
  // when to call get_recent vs search_lecture based on the phrasing.
  const sendQuickPrompt = (prompt: string) => {
    if (streaming) return;
    send(prompt);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter" || e.shiftKey) return;
    e.preventDefault();
    submit();
  };

  const noMessages = messages.length === 0;

  return (
    <div className="bg-primary-bg flex flex-1 flex-col justify-between p-8 md:p-12">
      <div ref={scrollRef} className="flex flex-1 flex-col overflow-y-auto">
        {noMessages ? (
          <EmptyState
            icon={<MdChatBubbleOutline />}
            title="Ask anything about today's lecture"
            description="Your questions stay private. Answers are grounded in the slides, transcript, and your course history."
          />
        ) : (
          messages.map((m) =>
            m.role === "student" ? (
              <StudentMessage key={m.id} message={m} />
            ) : (
              <InLectureMessage key={m.id} message={m} streaming={streaming} />
            ),
          )
        )}
      </div>

      <div className="flex flex-col gap-3 pt-4">
        {deferred.length > 0 && <DeferredQueue items={deferred} />}
        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          {QUICK_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => sendQuickPrompt(prompt)}
              disabled={streaming}
              className="bg-primary-contr border-divider text-primary-accent-dark hover:bg-primary-accent rounded-full border px-4 py-2 text-sm font-medium shadow-sm transition hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {prompt}
            </button>
          ))}
          <div className="ml-auto">
            <DeferToggle deferMode={deferMode} onToggle={setDeferMode} />
          </div>
        </div>
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={streaming && !deferMode}
            placeholder={
              deferMode
                ? "Queue a question for after lecture"
                : streaming
                  ? "Thinking…"
                  : "Ask a question"
            }
            className="focus:outline-primary-accent border-divider bg-primary-contr text-primary w-full rounded-2xl border px-6 py-5 pr-16 text-lg shadow-sm disabled:opacity-60"
          />
          <div className="absolute top-1/2 right-3 flex -translate-y-1/2 items-center gap-2">
            <button
              type="button"
              onClick={submit}
              disabled={!canSend}
              aria-label={deferMode ? "Queue question" : "Send question"}
              className="bg-primary-accent hover:bg-primary-accent-dark flex h-11 w-11 items-center justify-center rounded-full text-white shadow-md transition disabled:cursor-not-allowed disabled:opacity-30"
            >
              {deferMode ? (
                <MdSchedule className="h-5 w-5" />
              ) : (
                <MdSend className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StudentMessage({ message }: { message: Message }): ReactNode {
  return (
    <div className="bg-primary-tint text-primary-accent-dark mb-6 max-w-md self-end rounded-2xl px-6 py-4 text-lg font-medium shadow-md">
      {message.content}
    </div>
  );
}

function normalizeMathDelimiters(text: string): string {
  return text
    .replace(/\\\[([\s\S]*?)\\\]/g, (_, body: string) => `$$${body}$$`)
    .replace(/\\\(([\s\S]*?)\\\)/g, (_, body: string) => `$${body}$`);
}

function InLectureMessage({
  message,
  streaming,
}: {
  message: Message;
  streaming: boolean;
}): ReactNode {
  const hasContent = message.content.length > 0;
  const tools = message.toolCalls ?? [];
  if (!hasContent && tools.length === 0) {
    return (
      <div className="text-primary py-8 text-lg leading-9">
        {streaming ? (
          <span className="text-secondary inline-flex gap-1 text-base">
            <span className="bg-secondary inline-block h-2 w-2 animate-pulse rounded-full" />
            <span
              className="bg-secondary inline-block h-2 w-2 animate-pulse rounded-full"
              style={{ animationDelay: "120ms" }}
            />
            <span
              className="bg-secondary inline-block h-2 w-2 animate-pulse rounded-full"
              style={{ animationDelay: "240ms" }}
            />
          </span>
        ) : null}
      </div>
    );
  }

  const prepped = normalizeMathDelimiters(message.content);
  const cites = message.citations;

  // ReactMarkdown emits text nodes as strings; swap citation markers inside
  // each text node at render time.
  const expandText = (children: ReactNode): ReactNode => {
    if (typeof children === "string") return renderWithCitations(children, cites);
    if (Array.isArray(children)) return children.map(expandText);
    return children;
  };

  return (
    <div className="text-primary py-8 text-lg leading-9">
      {tools.length > 0 ? (
        <div className="mb-4 flex flex-wrap gap-1.5">
          {tools.map((t) => (
            <ToolCallChip key={t.id} tool={t} />
          ))}
        </div>
      ) : null}
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          p: ({ children }) => (
            <p className="mb-4 last:mb-0">{expandText(children)}</p>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold">{expandText(children)}</strong>
          ),
          em: ({ children }) => <em className="italic">{expandText(children)}</em>,
          ul: ({ children }) => (
            <ul className="mb-4 list-disc pl-8 last:mb-0">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="mb-4 list-decimal pl-8 last:mb-0">{children}</ol>
          ),
          li: ({ children }) => <li className="mb-1">{expandText(children)}</li>,
          code: ({ children }) => (
            <code className="bg-primary-tint/50 rounded px-1.5 py-0.5 font-mono text-base">
              {children}
            </code>
          ),
          h1: ({ children }) => (
            <h1 className="mb-3 text-2xl font-semibold">{expandText(children)}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="mb-3 text-xl font-semibold">{expandText(children)}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="mb-2 text-lg font-semibold">{expandText(children)}</h3>
          ),
        }}
      >
        {prepped}
      </ReactMarkdown>
      <SourcesTray manifest={cites} />
    </div>
  );
}

function DeferToggle({
  deferMode,
  onToggle,
}: {
  deferMode: boolean;
  onToggle: (next: boolean) => void;
}): ReactNode {
  return (
    <div
      role="group"
      aria-label="Answer timing"
      className="border-divider bg-primary-bg flex items-center rounded-full border p-1 text-xs font-medium"
    >
      <button
        type="button"
        onClick={() => onToggle(false)}
        aria-pressed={!deferMode}
        className={`flex items-center gap-1 rounded-full px-3 py-1 transition ${
          !deferMode
            ? "bg-primary-accent text-white shadow-sm"
            : "text-secondary"
        }`}
      >
        <MdBolt className="h-3.5 w-3.5" />
        Now
      </button>
      <button
        type="button"
        onClick={() => onToggle(true)}
        aria-pressed={deferMode}
        className={`flex items-center gap-1 rounded-full px-3 py-1 transition ${
          deferMode
            ? "bg-primary-accent text-white shadow-sm"
            : "text-secondary"
        }`}
      >
        <MdAccessTime className="h-3.5 w-3.5" />
        After
      </button>
    </div>
  );
}

function DeferredQueue({
  items,
}: {
  items: readonly DeferredQuestion[];
}): ReactNode {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-divider bg-primary-contr overflow-hidden rounded-xl border shadow-sm">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="text-primary-accent-dark hover:bg-primary-tint/40 flex w-full items-center justify-between gap-2 px-4 py-3 text-xs font-semibold tracking-wider uppercase transition"
      >
        <span className="flex items-center gap-2">
          <MdSchedule className="h-4 w-4" />
          Queued for after lecture · {items.length}
        </span>
        <MdExpandMore
          className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </button>
      {expanded && (
        <ul className="flex flex-col gap-1 px-4 pb-4">
          {items.map((item) => (
            <li key={item.id} className="text-primary text-sm leading-6">
              • {item.content}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
