"use client";

import { EmptyState } from "@/components/in-lecture/EmptyState";
import { useStudentSession } from "@/components/in-lecture/StudentSessionContext";
import { toggleBookmark } from "@/lib/actions/engagement";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  MdAutoAwesome,
  MdBookmark,
  MdBookmarkBorder,
  MdClose,
  MdOutlineArrowOutward,
  MdOutlineRecordVoiceOver,
} from "react-icons/md";

// Tolerance for considering the user "at the bottom" of the feed. A new line
// can render >200px tall when wrapped, so checking the post-update scroll
// position against a small threshold is unreliable — instead we record the
// user's intent on every scroll event and consult it when new lines arrive.
const PIN_THRESHOLD_PX = 80;

// Prefix prepended to the seeded question when a student clicks "Ask" on a
// transcript line. Frames the quoted snippet for the model so it grounds the
// answer in surrounding lecture context rather than treating the line in
// isolation.
const CLARIFY_PROMPT_PREFIX =
  "Please clarify what the professor meant by this, using what he said previously and the slides:";

// Mock recap content (PRD Feature 16). Generating a real recap from the
// rolling transcript window is a follow-up — for tomorrow we ship the UX
// surface so the interaction is demoable.
const RECAP_BULLETS: readonly string[] = [
  "The lecture is grounding today's material in why uncertainty and decision-making belong in this course.",
  "Recurring framing: model human uncertainty, then make good decisions with limited information.",
  "Worked example sets up the counting / combinatorics intuition used later in the lecture.",
];

export default function TranscriptPanel() {
  const { courseId, lectureId } = useParams<{
    courseId: string;
    lectureId: string;
  }>();
  const router = useRouter();
  const { sessionId, lines, done, initialBookmarkedIds } = useStudentSession();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Hydrate from server-loaded initial set so returning students see their
  // bookmarks on first render. Subsequent toggles update locally
  // (optimistic) and call the server action to persist.
  const [bookmarkedIds, setBookmarkedIds] = useState<ReadonlySet<string>>(
    () => new Set(initialBookmarkedIds),
  );
  const [recapOpen, setRecapOpen] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef<boolean>(true);

  const onScroll = (): void => {
    const el = scrollRef.current;
    if (!el) return;
    pinnedRef.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < PIN_THRESHOLD_PX;
  };

  useEffect(() => {
    if (!pinnedRef.current) return;
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight });
  }, [lines.length]);

  const handleToggleBookmark = (id: string): void => {
    // Optimistic update — toggle local state immediately, then persist.
    // If the server action fails we revert. Hand-rolled rather than using
    // useOptimistic because we want a Set, not a list, and the rollback
    // path is simple enough not to need the hook.
    const previouslyBookmarked = bookmarkedIds.has(id);
    setBookmarkedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    toggleBookmark(sessionId, id)
      .then((result) => {
        // Reconcile with server truth in case the optimistic state diverged
        // (e.g. another tab toggled at the same time).
        setBookmarkedIds((prev) => {
          const next = new Set(prev);
          if (result.bookmarked) next.add(id);
          else next.delete(id);
          return next;
        });
      })
      .catch(() => {
        // Roll back to pre-toggle state on failure.
        setBookmarkedIds((prev) => {
          const next = new Set(prev);
          if (previouslyBookmarked) next.add(id);
          else next.delete(id);
          return next;
        });
      });
  };

  if (lines.length === 0) {
    return (
      <div className="bg-primary-bg flex min-h-0 flex-1 items-center justify-center p-12">
        <EmptyState
          icon={<MdOutlineRecordVoiceOver />}
          title="Transcript will appear here"
          description="Once the lecture starts, each line will stream in live. Tap any line to ask InLecture about it."
        />
      </div>
    );
  }

  return (
    <div className="bg-primary-bg relative flex min-h-0 flex-1 flex-col">
      <div className="border-divider flex shrink-0 flex-wrap items-center gap-3 border-b px-6 py-4 md:px-12">
        <button
          type="button"
          onClick={() => setRecapOpen(true)}
          className="bg-primary-accent hover:bg-primary-accent-dark flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-white shadow-sm transition"
        >
          <MdAutoAwesome className="h-3.5 w-3.5" />
          Recap what I missed
        </button>
        <div
          aria-label={`${bookmarkedIds.size} ${bookmarkedIds.size === 1 ? "bookmark" : "bookmarks"}`}
          className="border-divider bg-primary-contr text-primary-accent-dark flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium shadow-sm"
        >
          <MdBookmark className="h-3.5 w-3.5" />
          <span className="tabular-nums">{bookmarkedIds.size}</span>
        </div>
        {!done && (
          <div className="text-primary-accent ml-auto flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase">
            <span className="bg-primary-accent inline-block h-2 w-2 animate-pulse rounded-full" />
            Live
          </div>
        )}
      </div>

      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-6 md:p-12"
      >
        {lines.map((item) => {
          const isSelected = selectedId === item.id;
          const isBookmarked = bookmarkedIds.has(item.id);

          return (
            <div
              key={item.id}
              className="group flex cursor-pointer gap-6"
              onClick={() => setSelectedId(isSelected ? null : item.id)}
            >
              <div className="flex shrink-0 flex-col items-start gap-1.5">
                <p
                  className={`pt-1 text-sm font-semibold tracking-wider ${
                    isSelected
                      ? "text-primary-accent"
                      : "text-secondary group-hover:text-primary-accent"
                  }`}
                >
                  {item.timestamp}
                </p>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleBookmark(item.id);
                  }}
                  aria-label={
                    isBookmarked ? "Remove bookmark" : "Bookmark this moment"
                  }
                  aria-pressed={isBookmarked}
                  className={`-ml-1.5 flex h-8 w-8 items-center justify-center rounded-md transition ${
                    isBookmarked
                      ? "bg-primary-tint text-primary-accent"
                      : "text-secondary hover:text-primary-accent hover:bg-primary-tint/60"
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
                className={`flex-1 text-lg font-medium ${
                  isSelected
                    ? "text-primary-accent"
                    : "text-primary group-hover:text-primary-accent"
                }`}
              >
                {item.content}
              </p>
              {isSelected && (
                <button
                  className="bg-primary-contr text-primary-accent-dark hover:bg-primary-tint flex h-fit w-fit shrink-0 items-center gap-1 rounded-md p-3 text-center text-base font-medium shadow-sm transition"
                  onClick={(e) => {
                    e.stopPropagation();
                    const q = encodeURIComponent(
                      `${CLARIFY_PROMPT_PREFIX} "${item.content.trim()}"`,
                    );
                    router.push(
                      `/learn/${courseId}/lectures/${lectureId}/ask?q=${q}`,
                    );
                  }}
                >
                  Ask
                  <MdOutlineArrowOutward />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {recapOpen && <RecapPanel onClose={() => setRecapOpen(false)} />}
    </div>
  );
}

function RecapPanel({ onClose }: { onClose: () => void }) {
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
              Here&apos;s what you missed
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close recap"
            className="text-secondary hover:text-primary-accent rounded-full p-1 transition"
          >
            <MdClose className="h-5 w-5" />
          </button>
        </div>
        <ul className="flex flex-col gap-3">
          {RECAP_BULLETS.map((b) => (
            <li key={b} className="text-primary flex gap-3 text-base leading-7">
              <span className="text-primary-accent mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
              <span>{b}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
