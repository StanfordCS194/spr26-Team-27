"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// How often we cut the audio stream and POST a chunk to /api/transcribe.
// Shorter = lower student-side latency but more API calls; 8s feels right.
const CHUNK_MS = 8000;

type Status = "idle" | "starting" | "recording" | "stopping" | "error";

export function RecordButton({ sessionId }: { sessionId: string }) {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const seqRef = useRef(0);

  const stop = useCallback(() => {
    setStatus("stopping");
    recorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    recorderRef.current = null;
    streamRef.current = null;
    setStatus("idle");
  }, []);

  useEffect(() => () => stop(), [stop]);

  async function start() {
    setError(null);
    setStatus("starting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      const recorder = new MediaRecorder(stream, { mimeType: mime });
      recorderRef.current = recorder;
      seqRef.current = 0;

      recorder.ondataavailable = async (e) => {
        if (!e.data || e.data.size === 0) return;
        const sequence = seqRef.current++;
        const fd = new FormData();
        fd.append("sessionId", sessionId);
        fd.append("sequence", String(sequence));
        fd.append("audio", e.data, `chunk-${sequence}.webm`);
        try {
          await fetch("/api/transcribe", { method: "POST", body: fd });
        } catch (err) {
          // Best-effort upload — log but don't kill the recording loop.
          console.error("chunk upload failed", err);
        }
      };

      recorder.start(CHUNK_MS);
      setStatus("recording");
    } catch (err) {
      setError(err instanceof Error ? err.message : "mic access failed");
      setStatus("error");
    }
  }

  const recording = status === "recording";

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        onClick={recording ? stop : start}
        disabled={status === "starting" || status === "stopping"}
        className={`flex h-32 w-32 items-center justify-center rounded-full text-lg font-semibold text-white shadow-lg transition disabled:opacity-50 ${
          recording
            ? "bg-red-600 hover:bg-red-700"
            : "bg-primary-accent hover:bg-primary-accent-dark"
        }`}
      >
        {recording ? "Stop" : status === "starting" ? "..." : "Record"}
      </button>
      <p className="text-secondary text-sm">
        {recording
          ? "Streaming audio in 8s chunks"
          : status === "error"
            ? error
            : "Tap to start the lecture"}
      </p>
    </div>
  );
}
