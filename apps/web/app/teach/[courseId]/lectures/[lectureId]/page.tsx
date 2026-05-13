import { LiveTranscriptPanel } from "@/components/instructor/LiveTranscriptPanel";
import { QuestionFeed } from "@/components/instructor/QuestionFeed";
import { SessionBar } from "@/components/instructor/SessionBar";

export default async function InstructorLecturePage({
  params,
}: {
  params: Promise<{ courseId: string; lectureId: string }>;
}) {
  const { courseId, lectureId } = await params;
  // TODO: resolve real sessions.id from (courseId, lectureId) + auth. Using
  // lectureId as the session key for now so the realtime loop is exercisable.
  const sessionId = lectureId;
  const shareUrl = `/learn/${courseId}/lectures/${lectureId}/ask`;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <LiveTranscriptPanel sessionId={sessionId} />
        <QuestionFeed sessionId={sessionId} />
      </div>
      <SessionBar
        sessionId={sessionId}
        shareUrl={shareUrl}
        courseId={courseId}
      />
    </div>
  );
}
