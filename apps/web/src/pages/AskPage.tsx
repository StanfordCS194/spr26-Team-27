import { useChatContext } from "@/hooks/useChat";
import type { Message } from "@/types/messages";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useRef, type KeyboardEvent } from "react";

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

  useEffect(() => {
    if (q) inputRef.current?.focus();
  }, [q]);

  // Stick to the bottom as deltas stream in.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key !== "Enter" || e.shiftKey) return;
    e.preventDefault();
    const value = (q ?? "").trim();
    if (!value) return;
    send(value);
    void navigate({ search: () => ({ q: undefined }), replace: true });
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
        <input
          ref={inputRef}
          type="text"
          value={q ?? ""}
          onChange={(e) =>
            void navigate({
              search: () => ({ q: e.target.value || undefined }),
              replace: true,
            })
          }
          onKeyDown={onKeyDown}
          disabled={streaming}
          placeholder={streaming ? "Thinking…" : "Ask a question"}
          className="focus:outline-primary-accent border-divider bg-primary-contr text-primary w-full rounded-2xl border p-6 text-xl shadow-sm disabled:opacity-60"
        />
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
