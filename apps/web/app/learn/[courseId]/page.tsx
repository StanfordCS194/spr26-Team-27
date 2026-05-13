import Link from "next/link";
import { notFound } from "next/navigation";
import {
  MdArrowForward,
  MdHistory,
  MdRadioButtonChecked,
  MdSchedule,
} from "react-icons/md";

import { EmptyState } from "@/components/in-lecture/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { requireStudent } from "@/lib/auth";
import { getCourseForStudent } from "@/lib/queries/dashboard";

export default async function LearnCoursePage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const student = await requireStudent();
  const detail = await getCourseForStudent(student.id, courseId);
  if (!detail) notFound();

  const { course, liveSession, upcomingSessions, pastSessions } = detail;

  return (
    <div className="bg-primary-bg flex h-full min-h-0 flex-col overflow-y-auto">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-10">
        <header className="flex flex-col gap-2">
          <p className="text-secondary text-[11px] font-semibold tracking-widest uppercase">
            {course.slug}
          </p>
          <h1 className="text-primary text-display font-display leading-tight font-bold">
            {course.title}
          </h1>
        </header>

        {liveSession && (
          <Link
            href={`/learn/${course.slug}/lectures/${liveSession.id}/ask`}
            className="bg-primary-accent hover:bg-primary-accent-dark flex items-center justify-between gap-3 rounded-2xl px-5 py-4 text-white shadow-sm transition"
          >
            <div className="flex flex-col gap-1">
              <span className="flex items-center gap-2 text-[11px] font-semibold tracking-widest uppercase">
                <MdRadioButtonChecked className="h-3.5 w-3.5 animate-pulse" />
                Live now
              </span>
              <span className="text-base font-semibold">
                {liveSession.title}
              </span>
            </div>
            <MdArrowForward className="h-5 w-5" />
          </Link>
        )}

        {upcomingSessions.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="text-secondary flex items-center gap-1.5 text-[11px] font-semibold tracking-widest uppercase">
              <MdSchedule className="h-3.5 w-3.5" />
              Upcoming
            </h2>
            <ul className="flex flex-col gap-2">
              {upcomingSessions.map((session) => (
                <li
                  key={session.id}
                  className="bg-primary-contr border-divider flex items-center justify-between gap-3 rounded-xl border px-4 py-3"
                >
                  <span className="text-primary text-sm font-medium">
                    {session.title}
                  </span>
                  <Badge tone="neutral">Scheduled</Badge>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="flex flex-col gap-3">
          <h2 className="text-secondary flex items-center gap-1.5 text-[11px] font-semibold tracking-widest uppercase">
            <MdHistory className="h-3.5 w-3.5" />
            Past sessions
          </h2>
          {pastSessions.length === 0 ? (
            <EmptyState
              icon={<MdHistory />}
              title="No past sessions yet"
              description="Once your instructor runs a session, its transcript, bookmarks, and deferred answers will live here."
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {pastSessions.map((session) => (
                <li key={session.id}>
                  <Link
                    href={`/learn/${course.slug}/lectures/${session.id}/transcript`}
                    className="bg-primary-contr border-divider hover:border-primary-accent flex items-center justify-between gap-3 rounded-xl border px-4 py-3 transition"
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="text-primary text-sm font-medium">
                        {session.title}
                      </span>
                      <span className="text-secondary text-xs">
                        {formatLongDate(session.endedAt ?? session.createdAt)}
                      </span>
                    </div>
                    <MdArrowForward className="text-secondary h-4 w-4" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function formatLongDate(d: Date): string {
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}
