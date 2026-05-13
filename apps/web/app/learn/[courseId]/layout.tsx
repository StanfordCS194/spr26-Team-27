import { notFound } from "next/navigation";

import CourseShell from "@/components/in-lecture/CourseShell";
import { lectures } from "@/data/lectures";
import { requireStudent } from "@/lib/auth";
import { getCourseForStudent } from "@/lib/queries/dashboard";

// Same reverse-lookup pattern used in CourseCard / the course-view page:
// student URLs are keyed by the friendly id from apps/web/data/lectures.ts,
// and unmapped sessions fall back to the raw UUID (the lecture layout will
// notFound them).
function sessionToLectureId(sessionId: string): string {
  return lectures.find((l) => l.sessionId === sessionId)?.id ?? sessionId;
}

export default async function LearnCourseLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const student = await requireStudent();
  const detail = await getCourseForStudent(student.id, courseId);

  if (!detail) notFound();

  const sidebarSessions = detail.allSessions.map((s) => ({
    id: sessionToLectureId(s.id),
    title: s.title,
    status: s.status,
  }));

  return (
    <CourseShell
      mode="student"
      courseSlug={detail.course.slug}
      sessions={sidebarSessions}
    >
      {children}
    </CourseShell>
  );
}
