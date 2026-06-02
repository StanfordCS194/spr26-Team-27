import Link from "next/link";
import { MdAdd, MdArrowForward, MdRadioButtonChecked } from "react-icons/md";

import { DashboardTopbar } from "@/components/dashboard/DashboardTopbar";
import { Badge } from "@/components/ui/Badge";
import { createCourse } from "@/lib/actions/instructor";
import { requireInstructor } from "@/lib/auth";
import { getCoursesForInstructor } from "@/lib/queries/instructor";

export default async function TeachDashboard({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; slug?: string }>;
}) {
  const instructor = await requireInstructor();
  const courses = await getCoursesForInstructor(instructor.id);
  const { error, slug } = await searchParams;
  const errorText = createErrorMessage(error, slug);

  return (
    <div className="bg-primary-bg flex h-full min-h-0 flex-col">
      <DashboardTopbar displayName={instructor.displayName ?? "Instructor"} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-10">
          <header className="flex flex-col gap-2">
            <p className="text-secondary text-[11px] font-semibold tracking-widest uppercase">
              Instructor
            </p>
            <h1 className="text-primary text-display font-display leading-tight font-bold">
              Your courses
            </h1>
          </header>

          {errorText && (
            <p
              role="alert"
              className="rounded-lg bg-orange-100 px-3 py-2 text-sm text-orange-700"
            >
              {errorText}
            </p>
          )}

          {courses.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2">
              {courses.map(({ course, liveSession, lectureCount }) => (
                <Link
                  key={course.id}
                  href={`/teach/${course.slug}`}
                  className="bg-primary-contr border-divider flex flex-col gap-3 rounded-2xl border p-6 shadow-sm transition hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-col gap-1">
                      <p className="text-secondary text-[11px] font-semibold tracking-widest uppercase">
                        {course.slug}
                      </p>
                      <h2 className="text-primary text-xl leading-tight font-semibold">
                        {course.title}
                      </h2>
                    </div>
                    {liveSession && (
                      <Badge tone="live" pulse>
                        Live
                      </Badge>
                    )}
                  </div>
                  <div className="text-secondary flex items-center justify-between text-sm">
                    <span>
                      {lectureCount} lecture{lectureCount === 1 ? "" : "s"}
                    </span>
                    <MdArrowForward className="h-4 w-4" />
                  </div>
                  {liveSession && (
                    <span className="text-primary-accent-dark flex items-center gap-1.5 text-xs font-medium">
                      <MdRadioButtonChecked className="h-3.5 w-3.5 animate-pulse" />
                      {liveSession.title} is live
                    </span>
                  )}
                </Link>
              ))}
            </div>
          )}

          {/* Create a new course */}
          <section className="bg-primary-contr border-divider flex flex-col gap-4 rounded-2xl border p-6 shadow-sm">
            <div className="flex flex-col gap-1">
              <h2 className="text-primary flex items-center gap-2 text-base font-semibold">
                <MdAdd className="text-primary-accent h-5 w-5" />
                New course
              </h2>
              <p className="text-secondary text-sm">
                Pick a short course code — students join with it.
              </p>
            </div>
            <form
              action={createCourse}
              className="flex flex-col gap-3 sm:flex-row"
            >
              <input
                type="text"
                name="course_slug"
                required
                placeholder="course code (e.g. cs-109)"
                className="border-divider focus:outline-primary-accent flex-1 rounded-lg border px-3 py-2 text-sm"
              />
              <input
                type="text"
                name="course_title"
                placeholder="Course title"
                className="border-divider focus:outline-primary-accent flex-1 rounded-lg border px-3 py-2 text-sm"
              />
              <button
                type="submit"
                className="bg-primary-accent hover:bg-primary-accent-dark rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm transition"
              >
                Create
              </button>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}

function createErrorMessage(
  code: string | undefined,
  slug: string | undefined,
): string | null {
  if (!code) return null;
  switch (code) {
    case "slug_taken":
      return `Course code "${slug ?? ""}" is already taken. Pick another.`;
    case "missing_slug":
      return "Enter a course code.";
    case "not_owner":
      return "You don't own that course.";
    case "missing_title":
      return "Give the lecture a title.";
    default:
      return code;
  }
}
