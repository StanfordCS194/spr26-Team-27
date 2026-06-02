import { notFound } from "next/navigation";

import CourseShell from "@/components/in-lecture/CourseShell";
import { requireInstructor } from "@/lib/auth";
import { getCourseForInstructor } from "@/lib/queries/instructor";

// Gate the instructor course tree on auth + course ownership, and feed the
// sidebar the course's real lectures. Lecture URLs are keyed by the session
// UUID (the session row IS the lecture).
export default async function TeachCourseLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const instructor = await requireInstructor();
  const detail = await getCourseForInstructor(instructor.id, courseId);
  if (!detail) notFound();

  const sidebarSessions = detail.allSessions.map((s) => ({
    id: s.id,
    title: s.title,
    status: s.status,
  }));

  return (
    <CourseShell
      mode="instructor"
      courseSlug={detail.course.slug}
      sessions={sidebarSessions}
    >
      {children}
    </CourseShell>
  );
}
