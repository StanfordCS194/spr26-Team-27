import { useLiveTranscriptContext } from "@/hooks/useLiveTranscript";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  MdAutoAwesome,
  MdBookmark,
  MdBookmarkBorder,
  MdClose,
  MdOutlineArrowOutward,
} from "react-icons/md";

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

// Mock recap content (PRD Feature 16). In the real product this is generated
// from a rolling window of recent transcript content.
const RECAP_BULLETS: readonly string[] = [
  "Selwyn (a CA) is filling in for Chris Piech, who's out sick.",
  "Today's framing: modeling human uncertainty and making good decisions with limited information.",
  "He's anchoring the lecture in why intelligence and decision-making belong in this course.",
];

function TranscriptPage(): React.ReactNode {
  const [selectedTimestamp, setSelectedTimestamp] = useState<string | null>(
    null,
  );
  const [bookmarks, setBookmarks] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [recapOpen, setRecapOpen] = useState<boolean>(false);
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

  const toggleBookmark = (timestamp: string): void => {
    setBookmarks((prev) => {
      const next = new Set(prev);
      if (next.has(timestamp)) next.delete(timestamp);
      else next.add(timestamp);
      return next;
    });
  };

  return (
    <div className="bg-primary-bg relative flex min-h-0 flex-1 flex-col">
      <div className="border-divider flex shrink-0 flex-wrap items-center gap-3 border-b px-12 py-6">
        <button
          type="button"
          onClick={() => setRecapOpen(true)}
          className="bg-primary-accent hover:bg-primary-accent-dark flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-white shadow-sm transition"
        >
          <MdAutoAwesome className="h-3.5 w-3.5" />
          Recap what I missed
        </button>
        <div
          aria-label={`${bookmarks.size} ${bookmarks.size === 1 ? "bookmark" : "bookmarks"}`}
          className="border-divider bg-primary-contr text-primary-accent-dark flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium shadow-sm"
        >
          <MdBookmark className="h-3.5 w-3.5" />
          <span className="tabular-nums">{bookmarks.size}</span>
        </div>
      </div>

      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-12"
      >
        {lines.map((item) => {
          const isSelected = selectedTimestamp === item.timestamp;
          const isBookmarked = bookmarks.has(item.timestamp);

          return (
            <div
              key={item.timestamp}
              className="group flex cursor-pointer gap-6"
              onClick={() =>
                setSelectedTimestamp(isSelected ? null : item.timestamp)
              }
            >
              <div className="flex shrink-0 flex-col items-start gap-1.5">
                <p
                  className={`${isSelected ? "text-primary-accent" : "group-hover:text-primary-accent"} pt-1 text-sm font-semibold tracking-wider text-olive-400`}
                >
                  {item.timestamp}
                </p>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleBookmark(item.timestamp);
                  }}
                  aria-label={
                    isBookmarked ? "Remove bookmark" : "Bookmark this moment"
                  }
                  aria-pressed={isBookmarked}
                  className={`-ml-1.5 flex h-8 w-8 items-center justify-center rounded-md transition ${
                    isBookmarked
                      ? "bg-primary-tint text-primary-accent"
                      : "text-olive-400 hover:text-primary-accent hover:bg-primary-tint/60"
                  }`}
                >
                  {isBookmarked ? (
                    <MdBookmark className="h-4 w-4" />
                  ) : (
                    <MdBookmarkBorder className="h-4 w-4" />
                  )}
                </button>
              </div>
              <p
                className={`${isSelected ? "text-primary-accent" : "group-hover:text-primary-accent"} flex-1 text-lg font-medium text-olive-700`}
              >
                {item.content}
              </p>
              {isSelected && (
                <button
                  className="bg-primary-contr text-primary-accent-dark flex h-fit w-fit shrink-0 items-center gap-1 rounded-md p-3 text-center text-lg font-medium shadow-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    void navigate({
                      to: "/learn/$courseId/lectures/$lectureId/ask",
                      params: { courseId, lectureId },
                      search: {
                        q: `${CLARIFY_PROMPT_PREFIX} "${item.content.trim()}"`,
                      },
                    });
                  }}
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

      {recapOpen && <RecapPanel onClose={() => setRecapOpen(false)} />}
    </div>
  );
}

export default TranscriptPage;

function RecapPanel({ onClose }: { onClose: () => void }): React.ReactNode {
  return (
    <div className="absolute inset-0 z-40 flex items-end justify-center bg-black/30 sm:items-center">
      <div className="bg-primary-contr border-divider mx-4 w-full max-w-lg rounded-2xl border p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <div className="text-primary-accent-dark flex items-center gap-2 text-xs font-semibold tracking-wider uppercase">
              <MdAutoAwesome className="h-4 w-4" />
              Recap
            </div>
            <h2 className="text-primary mt-1 text-xl font-semibold">
              Here's what you missed
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close recap"
            className="text-olive-500 hover:text-primary-accent rounded-full p-1 transition"
          >
            <MdClose className="h-5 w-5" />
          </button>
        </div>
        <ul className="flex flex-col gap-3">
          {RECAP_BULLETS.map((b) => (
            <li
              key={b}
              className="text-primary flex gap-3 text-base leading-7"
            >
              <span className="text-primary-accent mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
              <span>{b}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
