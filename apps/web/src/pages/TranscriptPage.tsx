import { useLiveTranscriptContext } from "@/hooks/useLiveTranscript";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { MdOutlineArrowOutward } from "react-icons/md";

// Tolerance for considering the user "at the bottom" of the feed. A new line
// can render as a >200px-tall paragraph when wrapped, so checking the
// post-update scroll position against a small threshold is unreliable —
// instead we record the user's intent on every scroll event and consult it
// when new lines arrive.
const PIN_THRESHOLD_PX = 80;

// Prefix prepended to the seeded question when a student clicks "Ask" on a
// transcript line. Frames the quoted snippet for the model so it grounds the
// answer in surrounding lecture context rather than treating the line in
// isolation.
const CLARIFY_PROMPT_PREFIX =
  "Please clarify what the professor meant by this, using what he said previously and the slides:";

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
  // Default to pinned so the very first batch of lines auto-follows.
  const pinnedRef = useRef<boolean>(true);

  const onScroll = (): void => {
    const el = scrollRef.current;
    if (!el) return;
    pinnedRef.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < PIN_THRESHOLD_PX;
  };

  // Auto-follow new lines when the user is pinned to the bottom. Keyed on
  // length (not the lines array reference) so the effect only fires when a
  // new line is actually appended.
  useEffect(() => {
    if (!pinnedRef.current) return;
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight });
  }, [lines.length]);

  return (
    <div
      ref={scrollRef}
      onScroll={onScroll}
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
                    search: {
                      q: `${CLARIFY_PROMPT_PREFIX} "${item.content.trim()}"`,
                    },
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
