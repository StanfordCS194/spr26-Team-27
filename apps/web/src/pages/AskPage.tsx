import { messages } from "@/data/messages";
import type { Message } from "@/types/messages";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

function AskPage() {
  const { q } = useSearch({
    from: "/learn/$courseId/lectures/$lectureId",
  });
  const navigate = useNavigate({
    from: "/learn/$courseId/lectures/$lectureId",
  });
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (q) inputRef.current?.focus();
  }, [q]);

  return (
    <div className="bg-primary-bg flex flex-1 flex-col justify-between p-12">
      <div className="flex flex-col">
        {messages.map((message) =>
          message.role === "student" ? (
            <StudentMessage key={message.id} message={message} />
          ) : (
            <InLectureMessage key={message.id} message={message} />
          ),
        )}
      </div>
      <div>
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
          placeholder="Ask a question"
          className="focus:outline-primary-accent border-divider bg-primary-contr text-primary w-full rounded-2xl border p-6 text-xl shadow-sm"
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
