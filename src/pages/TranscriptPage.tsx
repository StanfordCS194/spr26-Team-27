import { transcript } from "@/data/transcript";
import type { transcriptItem } from "@/types/transcript";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { MdOutlineArrowOutward } from "react-icons/md";

function TranscriptPage() {
  const [selectedTimestamp, setSelectedTimestamp] = useState<string | null>(
    null,
  );
  const { courseId, lectureId } = useParams({
    from: "/learn/$courseId/lectures/$lectureId",
  });
  const navigate = useNavigate();

  return (
    <div className="bg-primary-bg flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-12">
      {transcript.map((item: transcriptItem) => {
        if (item.content.trim() === "") {
          return null;
        }

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
    </div>
  );
}

export default TranscriptPage;
