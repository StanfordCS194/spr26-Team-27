"use client";

import { useLatestConfusionAnchor } from "@/lib/realtime/useLatestConfusionAnchor";
import { useLiveConfusion } from "@/lib/realtime/useLiveConfusion";
import { useLiveTranscript } from "@/lib/realtime/useLiveTranscript";
import { useMemo } from "react";
import { MdMyLocation } from "react-icons/md";

const LABELS: Record<keyof ReturnType<typeof useLiveConfusion>, string> = {
  im_lost: "I'm lost",
  re_explain: "Re-explain",
  what_just_happened: "What just happened?",
  give_example: "Give an example",
};

export function ConfusionGauge({ sessionId }: { sessionId: string }) {
  const totals = useLiveConfusion(sessionId, 60);
  const total =
    totals.im_lost +
    totals.re_explain +
    totals.what_just_happened +
    totals.give_example;
  const anchor = useLatestConfusionAnchor(sessionId);
  const transcript = useLiveTranscript(sessionId);

  // Resolve the anchor id to the matching transcript line so we can show a
  // human-readable timestamp on the jump button.
  const anchorLine = useMemo(() => {
    if (!anchor) return null;
    return transcript.find((t) => t.id === anchor.transcriptItemId) ?? null;
  }, [anchor, transcript]);

  const jumpToAnchor = () => {
    if (!anchorLine) return;
    const el = document.getElementById(
      `transcript-${anchorLine.timestampSeconds}`,
    );
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    el?.classList.add("bg-primary-tint/50");
    window.setTimeout(() => {
      el?.classList.remove("bg-primary-tint/50");
    }, 1500);
  };

  return (
    <div className="border-divider flex flex-col gap-3 px-6 py-4">
      <div className="flex items-center justify-between">
        <h3 className="text-primary text-lg font-semibold">
          Confusion (last 60s)
        </h3>
        <span
          className={`text-caption rounded-md px-2 py-1 font-semibold ${
            total === 0
              ? "bg-stone-100 text-stone-500"
              : total > 8
                ? "bg-red-100 text-red-700"
                : total > 3
                  ? "bg-orange-100 text-orange-700"
                  : "bg-primary-tint text-primary-accent-dark"
          }`}
        >
          {total === 0 ? "all clear" : `${total} signals`}
        </span>
      </div>
      {total === 0 ? (
        <p className="text-secondary text-xs leading-relaxed">
          Students haven&apos;t tapped any quick-prompt buttons in the last
          minute. You&apos;ll see counts here when they do.
        </p>
      ) : (
        <ul className="flex flex-col gap-1 text-sm">
          {(Object.keys(LABELS) as (keyof typeof LABELS)[]).map((k) => (
            <li key={k} className="flex justify-between">
              <span className="text-secondary">{LABELS[k]}</span>
              <span className="text-primary font-semibold">{totals[k]}</span>
            </li>
          ))}
        </ul>
      )}
      {anchorLine && (
        <button
          type="button"
          onClick={jumpToAnchor}
          title="Scroll the transcript to the line students were on when they last tapped a quick-prompt button"
          className="border-primary-accent/40 bg-primary-tint/40 text-primary-accent-dark hover:bg-primary-tint flex items-center gap-1.5 self-start rounded-full border px-2.5 py-1 text-[11px] font-semibold transition"
        >
          <MdMyLocation className="h-3.5 w-3.5" />
          Jump to {anchorLine.timestamp}
        </button>
      )}
    </div>
  );
}
