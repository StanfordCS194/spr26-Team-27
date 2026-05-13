import Link from "next/link";
import { MdArrowForward, MdRadioButtonChecked } from "react-icons/md";

import { DashboardTopbar } from "@/components/dashboard/DashboardTopbar";
import { requireInstructor } from "@/lib/auth";
import { getCoursesForInstructor } from "@/lib/queries/instructor-dashboard";

export default async function InstructorDashboardPage() {
  const instructor = await requireInstructor();
  const dashboard = await getCoursesForInstructor(instructor.id);
  const firstName =
    (instructor.displayName ?? "").split(/\s+/)[0] || "Instructor";

  return (
    <div className="bg-primary-bg flex h-full min-h-0 flex-col">
      <DashboardTopbar displayName={instructor.displayName ?? "Instructor"} />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-10">
          <header className="flex flex-col gap-2">
            <h1 className="text-primary font-display text-display font-bold">
              Welcome back, {firstName}.
            </h1>
            <p className="text-secondary text-subtitle">
              {dashboard.length === 0
                ? "You don't have any courses yet."
                : `You have ${dashboard.length} course${dashboard.length === 1 ? "" : "s"}.`}
            </p>
          </header>

          {dashboard.length === 0 ? (
            <p className="text-secondary text-sm">
              Create a course to get started with InLecture.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {dashboard.map(({ course, liveSession, recentSessions }) => (
                <Link
                  key={course.id}
                  href={`/teach/${course.slug}`}
                  className="bg-primary-contr border-divider hover:border-primary-accent flex flex-col gap-3 rounded-2xl border p-5 shadow-sm transition"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex flex-col gap-1">
                      <span className="text-secondary text-[11px] font-semibold tracking-widest uppercase">
                        {course.slug}
                      </span>
                      <span className="text-primary text-lg font-semibold">
                        {course.title}
                      </span>
                    </div>
                    <MdArrowForward className="text-secondary mt-1 h-5 w-5" />
                  </div>

                  {liveSession && (
                    <div className="bg-primary-accent flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold text-white">
                      <MdRadioButtonChecked className="h-3 w-3 animate-pulse" />
                      Live: {liveSession.title}
                    </div>
                  )}

                  {recentSessions.length > 0 && (
                    <p className="text-secondary text-xs">
                      {recentSessions.length} past session
                      {recentSessions.length === 1 ? "" : "s"}
                    </p>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
