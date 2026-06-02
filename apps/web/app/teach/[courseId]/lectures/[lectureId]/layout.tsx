import { notFound } from "next/navigation";

import Topbar from "@/components/in-lecture/Topbar";
import { requireInstructor } from "@/lib/auth";
import { getSessionForInstructor } from "@/lib/queries/instructor";

// Instructor lecture shell: gate on auth + course ownership and resolve the
// real session so the Topbar shows its title/status. [lectureId] is the
// session UUID.
export default async function InstructorLectureLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ courseId: string; lectureId: string }>;
}) {
  const { courseId, lectureId } = await params;
  const instructor = await requireInstructor();
  const ctx = await getSessionForInstructor(instructor.id, courseId, lectureId);
  if (!ctx) notFound();

  return (
    <div className="bg-primary-bg flex min-h-0 flex-1 flex-col">
      <Topbar
        mode="instructor"
        courseSlug={ctx.course.slug}
        sessionTitle={ctx.session.title}
        sessionStatus={ctx.session.status}
        sessionId={ctx.session.id}
      />
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
