import { notFound } from "next/navigation";

import { StudentSessionProvider } from "@/components/in-lecture/StudentSessionContext";
import Topbar from "@/components/in-lecture/Topbar";
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
  const student = await requireStudent();
  const ctx = await getSessionForStudent(student.id, courseId, lectureId);
  if (!ctx) notFound();

  // Idempotent: returns the existing id if the student has already joined,
  // creates one otherwise. Every engagement action downstream depends on
  // having a participant_id, so we materialize it here once per render
  // rather than scattering find-or-create logic across the action layer.
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
