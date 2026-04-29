import { useLiveTranscriptContext } from "@/hooks/useLiveTranscript";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { MdOutlineArrowOutward } from "react-icons/md";

function TranscriptPage() {
  const [selectedTimestamp, setSelectedTimestamp] = useState<string | null>(
    null,
  );
  const { courseId, lectureId } = useParams({
    from: "/learn/$courseId/lectures/$lectureId",
  });
  const navigate = useNavigate();
  const { lines, done, error } = useLiveTranscriptContext();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Stick to the bottom as new transcript lines land (mirrors how a real
  // live caption feed would behave). Only auto-scroll if the user hasn't
  // scrolled away.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 200;
    if (nearBottom) el.scrollTo({ top: el.scrollHeight });
  }, [lines]);

  return (
    <div
      ref={scrollRef}
      className="bg-primary-bg flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-12"
    >
      {lines.map((item) => {
        const isSelected = selectedTimestamp === item.timestamp;

        return (
          <div key={item.timestamp} className="flex gap-6">
            <div
              className="group flex flex-1 cursor-pointer items-start gap-6"
              onClick={() =>
                setSelectedTimestamp(isSelected ? null : item.timestamp)
              }
            >
              <p
                className={`${isSelected ? "text-primary-accent" : "group-hover:text-primary-accent"} pt-1 text-sm font-semibold tracking-wider text-olive-400`}
              >
                {item.timestamp}
              </p>
              <p
                className={`${isSelected ? "text-primary-accent" : "group-hover:text-primary-accent"} text-lg font-medium text-olive-700`}
              >
                {item.content}
              </p>
            </div>
            {isSelected && (
              <button
                className="bg-primary-contr text-primary-accent-dark flex h-fit w-fit shrink-0 items-center gap-1 rounded-md p-3 text-center text-lg font-medium shadow-sm"
                onClick={() =>
                  void navigate({
                    to: "/learn/$courseId/lectures/$lectureId/ask",
                    params: { courseId, lectureId },
                    search: { q: item.content.trim() },
                  })
                }
              >
                Ask
                <MdOutlineArrowOutward />
              </button>
            )}
          </div>
        );
      })}

      {/* Live indicator while the mock stream is still emitting frames. */}
      {!done && !error && (
        <div className="flex items-center gap-2 pt-2 text-sm text-olive-400">
          <span className="bg-primary-accent inline-block h-2 w-2 animate-pulse rounded-full" />
          live
        </div>
      )}
      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export default TranscriptPage;
