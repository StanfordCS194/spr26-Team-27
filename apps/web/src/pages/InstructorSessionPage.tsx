import { useAudioCapture } from "@/hooks/useAudioCapture";
import { useLiveTranscript, type TranscriptLine } from "@/hooks/useLiveTranscript";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function InstructorSessionPage() {
  const { sessionId } = useParams({
    from: "/instructor/session/$sessionId",
  });
  const navigate = useNavigate();
  const [session, setSession] = useState<{
    title: string;
    is_active: number;
  } | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/instructor/sessions/${sessionId}`, { credentials: "include" })
      .then((r) => r.json())
      .then((data: { session: { title: string; is_active: number } }) =>
        setSession(data.session),
      );
  }, [sessionId]);

  useEffect(() => {
    const match = document.cookie.match(
      /(?:^|;\s*)inlecture_token=([^;]+)/,
    );
    if (match) setAuthToken(match[1]);
  }, []);

  const wsUrl =
    authToken && session?.is_active
      ? `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/api/audio/${sessionId}?token=${authToken}`
      : null;

  const { capturing, start, stop } = useAudioCapture(wsUrl);
  const lines = useLiveTranscript(sessionId);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  const endSession = useCallback(async () => {
    stop();
    await fetch(`/api/instructor/sessions/${sessionId}/end`, {
      method: "PATCH",
      credentials: "include",
    });
    void navigate({ to: "/instructor" });
  }, [sessionId, stop, navigate]);

  if (!session) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-secondary text-xl">Loading session...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="border-divider flex items-center justify-between border-b px-6 py-4">
        <div>
          <h1 className="text-primary text-xl font-bold">{session.title}</h1>
          <p className="text-secondary text-sm">
            {session.is_active ? "Live" : "Ended"}
            {capturing && " — Recording audio"}
          </p>
        </div>
        <div className="flex gap-3">
          {session.is_active && !capturing && (
            <button
              onClick={() => void start()}
              className="bg-primary-accent text-primary-contr rounded-lg px-4 py-2 font-semibold"
            >
              Start Recording
            </button>
          )}
          {capturing && (
            <button
              onClick={stop}
              className="rounded-lg bg-yellow-500 px-4 py-2 font-semibold text-white"
            >
              Pause Recording
            </button>
          )}
          {session.is_active && (
            <button
              onClick={() => void endSession()}
              className="rounded-lg bg-red-500 px-4 py-2 font-semibold text-white"
            >
              End Session
            </button>
          )}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-6">
        <h2 className="text-primary text-lg font-semibold">Live Transcript</h2>
        {lines.length === 0 && (
          <p className="text-secondary">
            {capturing
              ? "Listening... transcript will appear here."
              : "Start recording to capture audio."}
          </p>
        )}
        {lines.map((line: TranscriptLine, i: number) => (
          <div key={i} className="flex gap-4">
            <span className="text-primary-accent shrink-0 text-sm font-semibold">
              {formatTime(line.timestampSeconds)}
            </span>
            <span className="text-primary text-lg">{line.content}</span>
          </div>
        ))}
        <div ref={transcriptEndRef} />
      </div>
    </div>
  );
}
