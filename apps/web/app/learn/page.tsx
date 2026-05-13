import { CourseCard } from "@/components/dashboard/CourseCard";
import { DashboardTopbar } from "@/components/dashboard/DashboardTopbar";
import { JoinCourseForm } from "@/components/dashboard/JoinCourseForm";
import { requireStudent } from "@/lib/auth";
import { getDashboardForStudent } from "@/lib/queries/dashboard";

export default async function StudentDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; slug?: string }>;
}) {
  const { error, slug } = await searchParams;
  const student = await requireStudent();
  const dashboard = await getDashboardForStudent(student.id);
  const liveCount = dashboard.filter((d) => d.liveSession).length;
  const firstName = (student.displayName ?? "").split(/\s+/)[0] || "there";
  const joinMessage = joinErrorMessage(error, slug);

  return (
    <div className="bg-primary-bg flex h-full min-h-0 flex-col">
      <DashboardTopbar displayName={student.displayName ?? "Student"} />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-10">
          <header className="flex flex-col gap-2">
            <h1 className="text-primary font-display text-display font-bold">
              Welcome back, {firstName}.
            </h1>
            <p className="text-secondary text-subtitle">
              {liveCount > 0
                ? liveCount === 1
                  ? "One of your courses is live right now."
                  : `${liveCount} of your courses are live right now.`
                : "No lectures live at the moment. Past sessions are below."}
            </p>
          </header>

          {dashboard.length === 0 ? (
            <div className="flex flex-col gap-6">
              <p className="text-secondary">
                You&apos;re not enrolled in any courses yet.
              </p>
              <JoinCourseForm
                defaultSlug={process.env.DEMO_COURSE_SLUG}
                message={joinMessage}
              />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {dashboard.map(({ course, liveSession, recentSessions }) => (
                  <CourseCard
                    key={course.id}
                    course={course}
                    liveSession={liveSession}
                    recentSessions={recentSessions}
                  />
                ))}
              </div>
              <JoinCourseForm message={joinMessage} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function joinErrorMessage(
  code: string | undefined,
  slug: string | undefined,
): string | null {
  if (!code) return null;
  switch (code) {
    case "unknown_course":
      return slug
        ? `We couldn't find a course with code "${slug}". Double-check with your instructor.`
        : "We couldn't find that course.";
    case "missing_slug":
      return "Please enter a course code.";
    default:
      return code;
  }
}
