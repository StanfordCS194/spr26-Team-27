import { LiveTranscriptPanel } from "@/components/instructor/LiveTranscriptPanel";
import { QuestionFeed } from "@/components/instructor/QuestionFeed";
import { RecordingPendingProvider } from "@/components/instructor/RecordingPendingContext";
import { SessionBar } from "@/components/instructor/SessionBar";
import { lectureById } from "@/data/lectures";
import { notFound } from "next/navigation";

export default async function InstructorLecturePage({
  params,
}: {
  params: Promise<{ courseId: string; lectureId: string }>;
}) {
  const { courseId, lectureId } = await params;
  const lecture = lectureById(lectureId);
  if (!lecture) notFound();
  const sessionId = lecture.sessionId;
  const shareUrl = `/learn/${courseId}/lectures/${lectureId}/ask`;

  return (
    <RecordingPendingProvider>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[minmax(0,1fr)] gap-4 overflow-hidden p-4 lg:grid-cols-[minmax(0,1fr)_380px]">
          <LiveTranscriptPanel sessionId={sessionId} />
          <QuestionFeed sessionId={sessionId} />
        </div>
        <SessionBar
          sessionId={sessionId}
          shareUrl={shareUrl}
          courseId={courseId}
        />
      </div>
    </RecordingPendingProvider>
  );
}
