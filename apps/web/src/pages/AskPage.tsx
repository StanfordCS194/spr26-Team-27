import { useChatContext } from "@/hooks/useChat";
import type { Message } from "@/types/messages";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { MdSend } from "react-icons/md";

function AskPage() {
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

  // Stick to the bottom as deltas stream in.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  const trimmed = draft.trim();
  const canSend = trimmed.length > 0 && !streaming;

  const submit = (): void => {
    if (!canSend) return;
    send(trimmed);
    setDraft("");
    // Drop any stale `?q=` left over from the transcript Ask flow.
    if (q !== undefined) {
      void navigate({ search: () => ({ q: undefined }), replace: true });
    }
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
      <div className="flex flex-col gap-2">
        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={streaming}
            placeholder={streaming ? "Thinking…" : "Ask a question"}
            className="focus:outline-primary-accent border-divider bg-primary-contr text-primary w-full rounded-2xl border p-6 pr-20 text-xl shadow-sm disabled:opacity-60"
          />
          <button
            type="button"
            onClick={submit}
            // Disabled when the input is empty or a stream is in flight.
            // Enter still submits — the button is just an obvious target.
            disabled={!canSend}
            aria-label="Send question"
            className="bg-primary-accent absolute top-1/2 right-3 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full text-white shadow-md transition disabled:cursor-not-allowed disabled:opacity-30"
          >
            <MdSend className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default AskPage;

function StudentMessage({ message }: { message: Message }) {
  return (
    <div className="max-w-96 self-end rounded-2xl bg-olive-300 px-6 py-4 text-xl font-medium text-olive-700 shadow-md">
      {message.content}
    </div>
  );
}

function InLectureMessage({ message }: { message: Message }) {
  return (
    <div className="text-primary py-12 text-xl leading-10">
      {message.content}
    </div>
  );
}
