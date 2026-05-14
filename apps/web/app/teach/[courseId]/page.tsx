import Link from "next/link";
import { notFound } from "next/navigation";
import {
  MdAdd,
  MdArrowForward,
  MdHistory,
  MdRadioButtonChecked,
  MdSchedule,
} from "react-icons/md";

import { NewSessionForm } from "@/components/instructor/NewSessionForm";
import { requireInstructor } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSessionsForCourse } from "@/lib/queries/instructor-dashboard";
import { courses } from "@spr26/db";
import { and, eq } from "drizzle-orm";

export default async function TeachCoursePage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId: slug } = await params;
  const instructor = await requireInstructor();

  const [course] = await db()
    .select()
    .from(courses)
    .where(and(eq(courses.slug, slug), eq(courses.instructorId, instructor.id)))
    .limit(1);

  if (!course) notFound();

  const { live, scheduled, past } = await getSessionsForCourse(course.id);

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
          <p className="text-secondary text-sm">
            Share with students:{" "}
            <span className="text-primary-accent font-semibold">
              inlecture.app/learn/{course.slug}
            </span>
          </p>
        </header>

        {live && (
          <Link
            href={`/teach/${course.slug}/lectures/${live.id}`}
            className="bg-primary-accent hover:bg-primary-accent-dark flex items-center justify-between gap-3 rounded-2xl px-5 py-4 text-white shadow-sm transition"
          >
            <div className="flex flex-col gap-1">
              <span className="flex items-center gap-2 text-[11px] font-semibold tracking-widest uppercase">
                <MdRadioButtonChecked className="h-3.5 w-3.5 animate-pulse" />
                Live now
              </span>
              <span className="text-base font-semibold">{live.title}</span>
            </div>
            <MdArrowForward className="h-5 w-5" />
          </Link>
        )}

        <section className="flex flex-col gap-3">
          <h2 className="text-secondary flex items-center gap-1.5 text-[11px] font-semibold tracking-widest uppercase">
            <MdAdd className="h-3.5 w-3.5" />
            New session
          </h2>
          <NewSessionForm courseId={course.id} />
        </section>

        {scheduled.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="text-secondary flex items-center gap-1.5 text-[11px] font-semibold tracking-widest uppercase">
              <MdSchedule className="h-3.5 w-3.5" />
              Scheduled
            </h2>
            <ul className="flex flex-col gap-2">
              {scheduled.map((session) => (
                <li key={session.id}>
                  <Link
                    href={`/teach/${course.slug}/lectures/${session.id}`}
                    className="bg-primary-contr border-divider hover:border-primary-accent flex items-center justify-between gap-3 rounded-xl border px-4 py-3 transition"
                  >
                    <span className="text-primary text-sm font-medium">
                      {session.title}
                    </span>
                    <MdArrowForward className="text-secondary h-4 w-4" />
                  </Link>
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
          {past.length === 0 ? (
            <p className="text-secondary text-sm">No past sessions yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {past.map((session) => (
                <li key={session.id}>
                  <Link
                    href={`/teach/${course.slug}/lectures/${session.id}`}
                    className="bg-primary-contr border-divider hover:border-primary-accent flex items-center justify-between gap-3 rounded-xl border px-4 py-3 transition"
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="text-primary text-sm font-medium">
                        {session.title}
                      </span>
                      <span className="text-secondary text-xs">
                        {formatDate(session.endedAt ?? session.createdAt)}
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

function formatDate(d: Date): string {
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}
