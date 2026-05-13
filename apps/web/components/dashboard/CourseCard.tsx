import type { Course, Session } from "@spr26/db";
import Link from "next/link";
import {
  MdArrowForward,
  MdHistory,
  MdRadioButtonChecked,
} from "react-icons/md";

import { Badge } from "@/components/ui/Badge";
import { lectures } from "@/data/lectures";

interface Props {
  course: Course;
  liveSession: Session | null;
  recentSessions: Session[];
}

// Reverse-map a real sessions.id back to the friendly lecture id used in
// student URLs (Amrit's data/lectures.ts). When a session isn't in the
// hand-mapped list we degrade to the raw UUID — the layout's lectureById
// guard will then notFound() rather than rendering a broken state.
function sessionToLectureId(sessionId: string): string {
  return lectures.find((l) => l.sessionId === sessionId)?.id ?? sessionId;
}

export function CourseCard({ course, liveSession, recentSessions }: Props) {
  const hasHistory = recentSessions.length > 0;
  return (
    <div className="bg-primary-contr border-divider flex flex-col gap-4 rounded-2xl border p-6 shadow-sm transition hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-secondary text-[11px] font-semibold tracking-widest uppercase">
            {course.slug}
          </p>
          <h2 className="text-primary text-xl leading-tight font-semibold">
            <Link
              href={`/learn/${course.slug}`}
              className="hover:text-primary-accent-dark transition"
            >
              {course.title}
            </Link>
          </h2>
        </div>
        {liveSession && (
          <Badge tone="live" pulse>
            Live
          </Badge>
        )}
      </div>

      {liveSession ? (
        <Link
          href={`/learn/${course.slug}/lectures/${sessionToLectureId(liveSession.id)}/ask`}
          className="bg-primary-accent hover:bg-primary-accent-dark flex items-center justify-between gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-sm transition"
        >
          <span className="flex items-center gap-2">
            <MdRadioButtonChecked className="h-4 w-4 animate-pulse" />
            Join {liveSession.title}
          </span>
          <MdArrowForward className="h-4 w-4" />
        </Link>
      ) : (
        <Link
          href={`/learn/${course.slug}`}
          className="border-divider text-primary-accent-dark hover:bg-primary-tint/40 flex items-center justify-between gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition"
        >
          <span>Open course</span>
          <MdArrowForward className="h-4 w-4" />
        </Link>
      )}

      <div className="flex flex-col gap-2">
        <div className="text-secondary flex items-center gap-1.5 text-[11px] font-semibold tracking-widest uppercase">
          <MdHistory className="h-3.5 w-3.5" />
          Recent sessions
        </div>
        {hasHistory ? (
          <ul className="flex flex-col gap-1">
            {recentSessions.map((session) => (
              <li key={session.id}>
                <Link
                  href={`/learn/${course.slug}/lectures/${sessionToLectureId(session.id)}/transcript`}
                  className="text-primary hover:bg-primary-tint/40 -mx-2 flex items-center justify-between rounded-md px-2 py-1.5 text-sm transition"
                >
                  <span className="truncate">{session.title}</span>
                  <span className="text-secondary shrink-0 text-xs">
                    {formatDate(session.endedAt ?? session.createdAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-secondary text-sm italic">No past sessions yet.</p>
        )}
      </div>
    </div>
  );
}

function formatDate(d: Date): string {
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
