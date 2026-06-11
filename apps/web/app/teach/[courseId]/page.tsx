import Link from "next/link";
import { notFound } from "next/navigation";
import {
  MdAdd,
  MdAnalytics,
  MdArrowForward,
  MdHistory,
  MdRadioButtonChecked,
  MdSchedule,
} from "react-icons/md";

import { Badge } from "@/components/ui/Badge";
import { createLecture } from "@/lib/actions/instructor";
import { requireInstructor } from "@/lib/auth";
import { getCourseForInstructor } from "@/lib/queries/instructor";
import type { Session } from "@spr26/db";

export default async function TeachCourseIndex({
  params,
  searchParams,
}: {
  params: Promise<{ courseId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { courseId } = await params;
  const instructor = await requireInstructor();
  const detail = await getCourseForInstructor(instructor.id, courseId);
  if (!detail) notFound();

  const { error } = await searchParams;
  const { course, liveSessions, scheduledSessions, endedSessions, analytics } =
    detail;

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
            Students join with code{" "}
            <span className="text-primary font-semibold">{course.slug}</span>.
          </p>
        </header>

        {error === "missing_title" && (
          <p
            role="alert"
            className="rounded-lg bg-orange-100 px-3 py-2 text-sm text-orange-700"
          >
            Give the lecture a title.
          </p>
        )}

        {/* New lecture */}
        <section className="bg-primary-contr border-divider flex flex-col gap-4 rounded-2xl border p-6 shadow-sm">
          <h2 className="text-primary flex items-center gap-2 text-base font-semibold">
            <MdAdd className="text-primary-accent h-5 w-5" />
            Schedule a lecture
          </h2>
          <form
            action={createLecture}
            className="flex flex-col gap-3 sm:flex-row"
          >
            <input type="hidden" name="course_slug" value={course.slug} />
            <input
              type="text"
              name="title"
              required
              placeholder="Lecture title (e.g. 4 - Conditional Probability)"
              className="border-divider focus:outline-primary-accent flex-1 rounded-lg border px-3 py-2 text-sm"
            />
            <button
              type="submit"
              className="bg-primary-accent hover:bg-primary-accent-dark rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm transition"
            >
              Add lecture
            </button>
          </form>
        </section>

        <section className="bg-primary-contr border-divider flex flex-col gap-4 rounded-2xl border p-6 shadow-sm">
          <h2 className="text-primary flex items-center gap-2 text-base font-semibold">
            <MdAnalytics className="text-primary-accent h-5 w-5" />
            Engagement over time
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <AnalyticsTile label="Lectures" value={analytics.lectureCount} />
            <AnalyticsTile label="Questions" value={analytics.totalQuestions} />
            <AnalyticsTile label="Signals" value={analytics.totalSignals} />
            <AnalyticsTile
              label="Q / lecture"
              value={analytics.averageQuestionsPerLecture}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <InsightLine
              label="Most active lecture"
              value={
                analytics.busiestLectureTitle
                  ? `${analytics.busiestLectureTitle} · ${analytics.busiestLectureQuestionCount} questions`
                  : "No question activity yet"
              }
            />
            <InsightLine
              label="Top confusion signal"
              value={
                analytics.topSignal
                  ? `${labelSignal(analytics.topSignal)} · ${analytics.topSignalCount} taps`
                  : "No confusion signals yet"
              }
            />
          </div>
        </section>

        {liveSessions.length > 0 && (
          <LectureSection
            title="Live now"
            icon={
              <MdRadioButtonChecked className="h-3.5 w-3.5 animate-pulse" />
            }
            sessions={liveSessions}
            slug={course.slug}
            tone="live"
          />
        )}

        <LectureSection
          title="Scheduled"
          icon={<MdSchedule className="h-3.5 w-3.5" />}
          sessions={scheduledSessions}
          slug={course.slug}
          tone="neutral"
          emptyHint="No upcoming lectures yet — add one above."
        />

        {endedSessions.length > 0 && (
          <LectureSection
            title="Past"
            icon={<MdHistory className="h-3.5 w-3.5" />}
            sessions={endedSessions}
            slug={course.slug}
            tone="neutral"
          />
        )}
      </div>
    </div>
  );
}

function AnalyticsTile({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="bg-primary-bg/60 border-divider rounded-xl border p-3">
      <p className="text-primary text-lg font-semibold tabular-nums">{value}</p>
      <p className="text-secondary text-[11px] font-semibold tracking-widest uppercase">
        {label}
      </p>
    </div>
  );
}

function InsightLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-divider rounded-xl border px-3 py-2.5">
      <p className="text-secondary text-[11px] font-semibold tracking-widest uppercase">
        {label}
      </p>
      <p className="text-primary mt-1 text-sm">{value}</p>
    </div>
  );
}

function labelSignal(signal: string): string {
  switch (signal) {
    case "im_lost":
      return "I'm lost";
    case "re_explain":
      return "Re-explain";
    case "what_just_happened":
      return "What just happened?";
    case "give_example":
      return "Give an example";
    default:
      return signal;
  }
}

function LectureSection({
  title,
  icon,
  sessions,
  slug,
  tone,
  emptyHint,
}: {
  title: string;
  icon: React.ReactNode;
  sessions: Session[];
  slug: string;
  tone: "live" | "neutral";
  emptyHint?: string;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-secondary flex items-center gap-1.5 text-[11px] font-semibold tracking-widest uppercase">
        {icon}
        {title}
      </h2>
      {sessions.length === 0 ? (
        emptyHint ? (
          <p className="text-secondary text-sm italic">{emptyHint}</p>
        ) : null
      ) : (
        <ul className="flex flex-col gap-2">
          {sessions.map((session) => (
            <li
              key={session.id}
              className="bg-primary-contr border-divider hover:border-primary-accent flex items-center justify-between gap-3 rounded-xl border px-4 py-3 transition"
            >
              <Link
                href={`/teach/${slug}/lectures/${session.id}`}
                className="text-primary hover:text-primary-accent-dark min-w-0 flex-1 truncate text-sm font-medium"
              >
                {session.title}
              </Link>
              <span className="flex shrink-0 items-center gap-3">
                <Badge tone={tone} pulse={tone === "live"}>
                  {session.status}
                </Badge>
                <Link
                  href={`/teach/${slug}/lectures/${session.id}/materials`}
                  className="text-primary-accent-dark text-xs font-medium hover:underline"
                >
                  Materials
                </Link>
                <Link
                  href={`/teach/${slug}/lectures/${session.id}`}
                  aria-label="Open lecture"
                  className="text-secondary hover:text-primary"
                >
                  <MdArrowForward className="h-4 w-4" />
                </Link>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
