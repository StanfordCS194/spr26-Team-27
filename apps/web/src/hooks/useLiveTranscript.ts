import { useEffect, useRef, useState } from "react";

export interface TranscriptLine {
  timestampSeconds: number;
  content: string;
}

export function useLiveTranscript(sessionId: string | null) {
  const [lines, setLines] = useState<TranscriptLine[]>([]);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!sessionId) return;

    const es = new EventSource(`/api/live-transcript/${sessionId}`);
    esRef.current = es;

    es.addEventListener("transcript", (e) => {
      const line = JSON.parse(e.data) as TranscriptLine;
      setLines((prev) => [...prev, line]);
    });

    es.onerror = () => {
      // Will auto-reconnect
    };

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [sessionId]);

  return lines;
}
