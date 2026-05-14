"use client";

import { EmptyState } from "@/components/in-lecture/EmptyState";
import { useStudentSession } from "@/components/in-lecture/StudentSessionContext";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  MdBookmark,
  MdBookmarkBorder,
  MdOutlineArrowOutward,
  MdOutlineRecordVoiceOver,
} from "react-icons/md";

export default function TranscriptPanel() {
  const { courseId, lectureId } = useParams<{
    courseId: string;
    lectureId: string;
  }>();
  const router = useRouter();
  const { lines, bookmarkedIds, toggleBookmark } = useStudentSession();
  const [selectedTimestamp, setSelectedTimestamp] = useState<string | null>(
    null,
  );
  // Filter chip: when on, only render lines the student has bookmarked.
  const [showOnlyBookmarks, setShowOnlyBookmarks] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the newest line as the drip advances (only when we're
  // showing the full transcript; in bookmark-only mode the user is reviewing).
  useEffect(() => {
    if (showOnlyBookmarks) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [lines.length, showOnlyBookmarks]);

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

  const visibleLines = showOnlyBookmarks
    ? lines.filter((l) => bookmarkedIds.has(l.id))
    : lines;
  const bookmarkCount = bookmarkedIds.size;

  return (
    <div className="bg-primary-bg flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="bg-primary-bg/95 sticky top-0 z-10 flex items-center gap-2 px-12 py-3 backdrop-blur">
        <span className="bg-primary-accent inline-block h-2 w-2 animate-pulse rounded-full" />
        <span className="text-primary-accent text-xs font-semibold tracking-wider uppercase">
          Live
        </span>
        <span className="text-secondary ml-2 text-xs">
          {lines.length} lines
        </span>
        <button
          type="button"
          onClick={() => setShowOnlyBookmarks((v) => !v)}
          disabled={bookmarkCount === 0 && !showOnlyBookmarks}
          aria-pressed={showOnlyBookmarks}
          className={`ml-auto inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
            showOnlyBookmarks
              ? "bg-primary-accent border-primary-accent text-white"
              : "border-divider text-secondary hover:text-primary disabled:opacity-30"
          }`}
        >
          <MdBookmark className="h-3 w-3" />
          Bookmarks · {bookmarkCount}
        </button>
      </div>
      <div className="flex flex-col gap-6 px-12 pb-12">
        {showOnlyBookmarks && visibleLines.length === 0 ? (
          <p className="text-secondary py-8 text-center text-sm">
            No bookmarks yet — tap the bookmark icon on a line to save it.
          </p>
        ) : null}
        {visibleLines.map((item) => {
          const isSelected = selectedTimestamp === item.timestamp;
          const isBookmarked = bookmarkedIds.has(item.id);
          return (
            <div key={item.timestamp} className="group/line flex gap-6">
              <div
                className="flex flex-1 cursor-pointer items-start gap-6"
                onClick={() =>
                  setSelectedTimestamp(isSelected ? null : item.timestamp)
                }
              >
                <p
                  className={`${
                    isSelected
                      ? "text-primary-accent"
                      : "group-hover/line:text-primary-accent text-secondary"
                  } pt-1 text-sm font-semibold tracking-wider`}
                >
                  {item.timestamp}
                </p>
                <p
                  className={`${
                    isSelected
                      ? "text-primary-accent"
                      : "group-hover/line:text-primary-accent text-primary"
                  } text-lg font-medium`}
                >
                  {item.content}
                </p>
              </div>
              <div className="flex shrink-0 items-start gap-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleBookmark(item.id);
                  }}
                  aria-label={isBookmarked ? "Remove bookmark" : "Bookmark"}
                  aria-pressed={isBookmarked}
                  title={
                    isBookmarked ? "Remove bookmark" : "Bookmark this line"
                  }
                  className={`flex h-9 w-9 items-center justify-center rounded-full transition ${
                    isBookmarked
                      ? "text-primary-accent"
                      : "text-secondary hover:text-primary-accent opacity-0 group-hover/line:opacity-100 focus:opacity-100"
                  }`}
                >
                  {isBookmarked ? (
                    <MdBookmark className="h-5 w-5" />
                  ) : (
                    <MdBookmarkBorder className="h-5 w-5" />
                  )}
                </button>
                {isSelected && (
                  <button
                    className="bg-primary-contr text-primary-accent-dark hover:bg-primary-tint flex h-fit w-fit items-center gap-1 rounded-md p-3 text-center text-base font-medium shadow-sm transition"
                    onClick={() => {
                      const q = encodeURIComponent(item.content.trim());
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
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
