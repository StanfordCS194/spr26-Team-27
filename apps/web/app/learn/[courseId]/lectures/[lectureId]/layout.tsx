import { notFound } from "next/navigation";

import { StudentSessionProvider } from "@/components/in-lecture/StudentSessionContext";
import Topbar from "@/components/in-lecture/Topbar";
import { lectureById } from "@/data/lectures";
import { requireStudent } from "@/lib/auth";
import { getSessionForStudent } from "@/lib/queries/dashboard";
import {
  ensureParticipant,
  getBookmarkedTranscriptIds,
} from "@/lib/queries/session";

export default async function StudentLectureLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ courseId: string; lectureId: string }>;
}) {
  const { courseId, lectureId } = await params;

  // Amrit's URL contract: [lectureId] is the friendly id ("1" / "2" / "3")
  // and apps/web/data/lectures.ts owns the mapping to a real session UUID.
  // Resolve here so the rest of the layout works in terms of session.id.
  const lecture = lectureById(lectureId);
  if (!lecture) notFound();

  const student = await requireStudent();
  const ctx = await getSessionForStudent(
    student.id,
    courseId,
    lecture.sessionId,
  );
  if (!ctx) notFound();

  // Idempotent: every engagement action downstream depends on having a
  // participant_id, so we materialize it here once per render rather than
  // scattering find-or-create logic across the action layer.
  const participantId = await ensureParticipant(ctx.session.id);
  const initialBookmarks = await getBookmarkedTranscriptIds(participantId);

  return (
    <StudentSessionProvider
      sessionId={ctx.session.id}
      sessionStatus={ctx.session.status}
      participantId={participantId}
      initialBookmarkedIds={initialBookmarks}
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <Topbar
          mode="student"
          courseSlug={ctx.course.slug}
          sessionTitle={ctx.session.title}
          sessionStatus={ctx.session.status}
          sessionId={ctx.session.id}
        />
        <div className="flex min-h-0 flex-1">{children}</div>
      </div>
    </StudentSessionProvider>
  );
}
