import { useChatContext } from "@/hooks/useChat";
import type { Message } from "@/types/messages";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import {
  MdSend,
  MdSchedule,
  MdBolt,
  MdAccessTime,
  MdExpandMore,
} from "react-icons/md";

// Mock quick prompts (PRD Feature 10). Tapping a chip submits it as a normal
// question. "I'm lost" lives in the topbar so it isn't duplicated here.
const QUICK_PROMPTS: readonly string[] = [
  "Re-explain that",
  "Give an example",
  "What just happened?",
];

interface DeferredQuestion {
  id: string;
  content: string;
}

function AskPage(): React.ReactNode {
  const { q } = useSearch({
    from: "/learn/$courseId/lectures/$lectureId",
  });
  const navigate = useNavigate({
    from: "/learn/$courseId/lectures/$lectureId",
  });
  const { messages, streaming, error, send } = useChatContext();
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Draft lives in local state. We seed it from `?q=` when that param arrives
  // externally (e.g. TranscriptPage's "Ask" button navigates here with a
  // pre-filled question), but typing only updates local state — round-tripping
  // every keystroke through the URL was dropping characters.
  //
  // The `prevQ` pattern is the React-recommended way to sync state on a prop
  // change without using an effect (see react.dev: "Storing information from
  // previous renders").
  const [draft, setDraft] = useState<string>(q ?? "");
  const [prevQ, setPrevQ] = useState<string | undefined>(q);
  if (q !== prevQ) {
    setPrevQ(q);
    if (q) setDraft(q);
  }
  useEffect(() => {
    if (q) inputRef.current?.focus();
  }, [q]);

  // Mock deferred-question queue (PRD Feature 9.2). Local-only; in the real
  // product these would persist with the session and surface in the
  // post-session summary.
  const [deferMode, setDeferMode] = useState<boolean>(false);
  const [deferred, setDeferred] = useState<DeferredQuestion[]>([]);

  // Stick to the bottom as deltas stream in.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  const trimmed = draft.trim();
  const canSend = trimmed.length > 0 && !streaming;

  const clearDraft = (): void => {
    setDraft("");
    if (q !== undefined) {
      void navigate({ search: () => ({ q: undefined }), replace: true });
    }
  };

  const submit = (): void => {
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

  // Quick prompts always send immediately — the whole point is one tap → answer.
  const sendQuickPrompt = (prompt: string): void => {
    if (streaming) return;
    send(prompt);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key !== "Enter" || e.shiftKey) return;
    e.preventDefault();
    submit();
  };

  return (
    <div className="bg-primary-bg flex flex-1 flex-col justify-between p-12">
      <div ref={scrollRef} className="flex flex-col overflow-y-auto">
        {messages.map((message) =>
          message.role === "student" ? (
            <StudentMessage key={message.id} message={message} />
          ) : (
            <InLectureMessage key={message.id} message={message} />
          ),
        )}
      </div>
      <div className="flex flex-col gap-3">
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
            className="focus:outline-primary-accent border-divider bg-primary-contr text-primary w-full rounded-2xl border p-6 pr-20 text-xl shadow-sm disabled:opacity-60"
          />
          <div className="absolute top-1/2 right-3 flex -translate-y-1/2 items-center gap-2">
            <button
              type="button"
              onClick={submit}
              // Disabled when the input is empty or a stream is in flight.
              // Enter still submits — the button is just an obvious target.
              disabled={!canSend}
              aria-label={deferMode ? "Queue question" : "Send question"}
              className="bg-primary-accent flex h-12 w-12 items-center justify-center rounded-full text-white shadow-md transition disabled:cursor-not-allowed disabled:opacity-30"
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

export default AskPage;

function StudentMessage({ message }: { message: Message }): React.ReactNode {
  return (
    <div className="max-w-96 self-end rounded-2xl bg-olive-300 px-6 py-4 text-xl font-medium text-olive-700 shadow-md">
      {message.content}
    </div>
  );
}

function InLectureMessage({ message }: { message: Message }): React.ReactNode {
  return (
    <div className="text-primary py-12 text-xl leading-10">
      {message.content}
    </div>
  );
}

function DeferToggle({
  deferMode,
  onToggle,
}: {
  deferMode: boolean;
  onToggle: (next: boolean) => void;
}): React.ReactNode {
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
            : "text-olive-500"
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
            : "text-olive-500"
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
}): React.ReactNode {
  const [expanded, setExpanded] = useState<boolean>(false);

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
