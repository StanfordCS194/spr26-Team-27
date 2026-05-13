"use client";

import { Badge } from "@/components/ui/Badge";
import { useLiveConfusion } from "@/lib/realtime/useLiveConfusion";
import { useLiveQuestions } from "@/lib/realtime/useLiveQuestions";
import { useLiveTranscript } from "@/lib/realtime/useLiveTranscript";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  MdCheck,
  MdContentCopy,
  MdFiberManualRecord,
  MdFlagCircle,
  MdStop,
} from "react-icons/md";

const CHUNK_MS = 8000;

type Status = "idle" | "starting" | "recording" | "stopping" | "error";

function formatElapsed(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function SessionBar({
  sessionId,
  shareUrl,
  courseId,
}: {
  sessionId: string;
  shareUrl: string;
  courseId: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  // Lazy initializer keeps render pure; SSR also can't call Date.now() during
  // render without producing a hydration mismatch.
  const [now, setNow] = useState<number>(() => 0);
  const [copied, setCopied] = useState(false);
  const [ending, setEnding] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const seqRef = useRef(0);

  const transcript = useLiveTranscript(sessionId);
  const questions = useLiveQuestions(sessionId);
  const confusion = useLiveConfusion(sessionId, 60);
  const confusionTotal: number =
    confusion.im_lost +
    confusion.re_explain +
    confusion.what_just_happened +
    confusion.give_example;

  useEffect(() => {
    if (status !== "recording") return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [status]);

  const stop = useCallback(() => {
    setStatus("stopping");
    recorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    recorderRef.current = null;
    streamRef.current = null;
    setStartedAt(null);
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
          console.error("chunk upload failed", err);
        }
      };

      recorder.start(CHUNK_MS);
      setStartedAt(Date.now());
      setStatus("recording");
    } catch (err) {
      setError(err instanceof Error ? err.message : "mic access failed");
      setStatus("error");
    }
  }

  const recording = status === "recording";
  const elapsed = startedAt ? now - startedAt : 0;

  const copy = useCallback(() => {
    void (async () => {
      try {
        const absolute =
          typeof window !== "undefined"
            ? new URL(shareUrl, window.location.origin).toString()
            : shareUrl;
        await navigator.clipboard.writeText(absolute);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      } catch {
        /* ignore */
      }
    })();
  }, [shareUrl]);

  const finish = useCallback(() => {
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        recording
          ? "End the lecture? Recording will stop and students will see the session as ended."
          : "End the lecture? Students will see the session as ended.",
      )
    ) {
      return;
    }
    setEnding(true);
    if (recording) stop();
    // TODO: POST /api/sessions/[id]/end to flip sessions.status='ended'. For
    // now we just route the instructor back to the course index.
    router.push(`/teach/${courseId}`);
  }, [courseId, recording, router, stop]);

  return (
    <div className="border-divider bg-primary-contr/95 sticky bottom-0 z-20 border-t shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.12)] backdrop-blur">
      <div className="flex items-center gap-5 px-6 py-3">
        <button
          onClick={recording ? stop : start}
          disabled={status === "starting" || status === "stopping"}
          className={cn(
            "flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white shadow-md transition disabled:opacity-50",
            recording
              ? "bg-red-600 hover:bg-red-700"
              : "bg-primary-accent hover:bg-primary-accent-dark",
          )}
        >
          {recording ? (
            <>
              <MdStop className="h-4 w-4" />
              Stop recording
            </>
          ) : (
            <>
              <MdFiberManualRecord className="h-4 w-4" />
              {status === "starting" ? "Starting…" : "Record"}
            </>
          )}
        </button>

        <div className="border-divider flex items-center gap-2 border-l pl-5">
          {recording ? (
            <>
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-red-500" />
              <span className="text-primary font-mono text-sm tabular-nums">
                {formatElapsed(elapsed)}
              </span>
              <span className="text-secondary text-xs">live</span>
            </>
          ) : (
            <span className="text-secondary text-xs">
              {error ?? "Tap Record to start the lecture"}
            </span>
          )}
        </div>

        <div className="border-divider hidden items-center gap-4 border-l pl-5 md:flex">
          <Metric label="Transcript" value={`${transcript.length}`} />
          <Metric label="Questions" value={`${questions.length}`} />
          <ConfusionMeter total={confusionTotal} />
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={copy}
            className="text-secondary hover:text-primary border-divider flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium transition hover:bg-stone-50"
            aria-label="Copy student join link"
          >
            {copied ? (
              <MdCheck className="text-primary-accent h-3.5 w-3.5" />
            ) : (
              <MdContentCopy className="h-3.5 w-3.5" />
            )}
            {copied ? "Copied" : "Copy student link"}
          </button>
          <button
            onClick={finish}
            disabled={ending}
            className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-50"
            aria-label="End lecture"
          >
            <MdFlagCircle className="h-3.5 w-3.5" />
            {ending ? "Ending…" : "End lecture"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-primary text-sm font-semibold tabular-nums">
        {value}
      </span>
      <span className="text-secondary text-[11px] tracking-wide uppercase">
        {label}
      </span>
    </div>
  );
}

function ConfusionMeter({ total }: { total: number }) {
  const tone =
    total === 0
      ? "neutral"
      : total > 8
        ? "danger"
        : total > 3
          ? "warning"
          : "accent";
  return (
    <div className="flex items-baseline gap-1.5">
      <Badge tone={tone} pulse={total > 3}>
        {total === 0 ? "clear" : `${total}`}
      </Badge>
      <span className="text-secondary text-[11px] tracking-wide uppercase">
        Confusion · 60s
      </span>
    </div>
  );
}
