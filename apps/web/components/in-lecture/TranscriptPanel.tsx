"use client";

import { EmptyState } from "@/components/in-lecture/EmptyState";
import { useStudentSession } from "@/components/in-lecture/StudentSessionContext";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  MdOutlineArrowOutward,
  MdOutlineRecordVoiceOver,
} from "react-icons/md";

export default function TranscriptPanel() {
  const { courseId, lectureId } = useParams<{
    courseId: string;
    lectureId: string;
  }>();
  const router = useRouter();
  const { lines } = useStudentSession();
  const [selectedTimestamp, setSelectedTimestamp] = useState<string | null>(
    null,
  );
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the newest line as the drip advances.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [lines.length]);

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
    <div className="bg-primary-bg flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="bg-primary-bg/95 sticky top-0 z-10 flex items-center gap-2 px-12 py-3 backdrop-blur">
        <span className="bg-primary-accent inline-block h-2 w-2 animate-pulse rounded-full" />
        <span className="text-primary-accent text-xs font-semibold tracking-wider uppercase">
          Live
        </span>
        <span className="text-secondary ml-2 text-xs">
          {lines.length} lines
        </span>
      </div>
      <div className="flex flex-col gap-6 px-12 pb-12">
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
                  className={`${
                    isSelected
                      ? "text-primary-accent"
                      : "group-hover:text-primary-accent text-secondary"
                  } pt-1 text-sm font-semibold tracking-wider`}
                >
                  {item.timestamp}
                </p>
                <p
                  className={`${
                    isSelected
                      ? "text-primary-accent"
                      : "group-hover:text-primary-accent text-primary"
                  } text-lg font-medium`}
                >
                  {item.content}
                </p>
              </div>
              {isSelected && (
                <button
                  className="bg-primary-contr text-primary-accent-dark hover:bg-primary-tint flex h-fit w-fit shrink-0 items-center gap-1 rounded-md p-3 text-center text-base font-medium shadow-sm transition"
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
          );
        })}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
