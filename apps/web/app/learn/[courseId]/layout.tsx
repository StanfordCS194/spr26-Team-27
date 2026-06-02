import { notFound } from "next/navigation";

import CourseShell from "@/components/in-lecture/CourseShell";
import { requireStudent } from "@/lib/auth";
import { getCourseForStudent } from "@/lib/queries/dashboard";

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
    id: s.id,
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
