import Topbar from "@/components/inLecture/Topbar";
import { ChatProvider, useChat } from "@/hooks/useChat";
import {
  LiveTranscriptProvider,
  useLiveTranscript,
} from "@/hooks/useLiveTranscript";
import AskPage from "@/pages/AskPage";
import TranscriptPage from "@/pages/TranscriptPage";
import { Outlet, useParams } from "@tanstack/react-router";
import type { ReactNode } from "react";

function InLectureLayout() {
  const { lectureId } = useParams({
    from: "/learn/$courseId/lectures/$lectureId",
  });

  return (
    // Re-key on lectureId so chat AND transcript state remount (and reset)
    // when the user switches lectures. Cheaper and clearer than diffing
    // inside each hook.
    <LectureScope key={lectureId} lectureId={lectureId}>
      <div className="flex min-h-0 flex-1 flex-col">
        <Topbar />

        {/* Compact view -> renders ask page OR transcript page */}
        <div className="flex min-h-0 flex-1 lg:hidden">
          <Outlet />
        </div>

        {/* Desktop view -> renders ask page AND transcript page */}
        <div className="divide-divider hidden min-h-0 flex-1 divide-x-2 lg:flex">
          <div className="flex flex-3">
            <AskPage />
          </div>
          <div className="flex flex-1">
            <TranscriptPage />
          </div>
        </div>
      </div>
    </LectureScope>
  );
}

function LectureScope({
  lectureId,
  children,
}: {
  lectureId: string;
  children: ReactNode;
}): ReactNode {
  const chat = useChat(lectureId);
  const transcript = useLiveTranscript();
  return (
    <ChatProvider value={chat}>
      <LiveTranscriptProvider value={transcript}>
        {children}
      </LiveTranscriptProvider>
    </ChatProvider>
  );
}

export default InLectureLayout;
