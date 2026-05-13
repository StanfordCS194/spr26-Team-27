"use client";

import { EmptyState } from "@/components/in-lecture/EmptyState";
import { useRecordingPending } from "@/components/instructor/RecordingPendingContext";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { useLiveTranscript } from "@/lib/realtime/useLiveTranscript";
import { useEffect, useRef } from "react";
import { MdGraphicEq } from "react-icons/md";

export function LiveTranscriptPanel({ sessionId }: { sessionId: string }) {
  const items = useLiveTranscript(sessionId);
  const { pending } = useRecordingPending();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [items.length, pending.length]);

  const totalRows = items.length + pending.length;

  return (
    <Card className="h-full">
      <CardHeader
        title="Live transcript"
        right={
          <span>
            {totalRows === 0
              ? "Idle"
              : `${items.length} lines${pending.length > 0 ? ` · ${pending.length} processing` : ""}`}
          </span>
        }
      />
      <CardBody>
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
          {totalRows === 0 ? (
            <EmptyState
              icon={<MdGraphicEq />}
              title="Waiting for your lecture"
              description="Tap Record below to start streaming audio. Each chunk gets transcribed and pushed to students live."
            />
          ) : (
            <ul className="flex flex-col gap-3 px-5 py-5">
              {items.map((item) => (
                <li
                  key={item.id}
                  id={`transcript-${item.timestampSeconds}`}
                  className="flex gap-3 rounded-lg px-2 py-1.5 transition hover:bg-stone-50"
                >
                  <span className="text-secondary shrink-0 pt-0.5 font-mono text-[11px] tabular-nums">
                    {item.timestamp}
                  </span>
                  <span className="text-primary text-sm leading-6">
                    {item.content}
                  </span>
                </li>
              ))}
              {pending.map((p) => (
                <PendingChunkRow key={p.id} />
              ))}
            </ul>
          )}
        </div>
      </CardBody>
    </Card>
  );
}

function PendingChunkRow() {
  return (
    <li
      aria-busy="true"
      aria-label="Transcribing chunk"
      className="flex animate-pulse gap-3 rounded-lg px-2 py-1.5 opacity-70"
    >
      <span className="font-mono text-[11px] tabular-nums text-stone-400">
        …
      </span>
      <span className="flex flex-1 flex-col gap-1.5">
        <span className="block h-3 w-3/4 rounded bg-stone-200" />
        <span className="block h-3 w-1/2 rounded bg-stone-200" />
      </span>
    </li>
  );
}
