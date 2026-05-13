import { and, desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";

import CourseShell from "@/components/in-lecture/CourseShell";
import { requireInstructor } from "@/lib/auth";
import { db } from "@/lib/db";
import { courses, sessions } from "@spr26/db";

export default async function TeachCourseLayout({
  children,
  params,
}: {
  children: React.ReactNode;
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

  const allSessions = await db()
    .select({ id: sessions.id, title: sessions.title, status: sessions.status })
    .from(sessions)
    .where(eq(sessions.courseId, course.id))
    .orderBy(desc(sessions.startedAt), desc(sessions.createdAt));

  const sidebarSessions = allSessions.map((s) => ({
    id: s.id,
    title: s.title,
    status: s.status,
  }));

  return (
    <CourseShell mode="instructor" courseSlug={slug} sessions={sidebarSessions}>
      {children}
    </CourseShell>
  );
}
