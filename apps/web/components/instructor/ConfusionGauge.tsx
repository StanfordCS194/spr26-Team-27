"use client";

import { useLiveConfusion } from "@/lib/realtime/useLiveConfusion";

const LABELS: Record<keyof ReturnType<typeof useLiveConfusion>, string> = {
  im_lost: "I'm lost",
  re_explain: "Re-explain",
  what_just_happened: "What just happened?",
  give_example: "Give an example",
};

export function ConfusionGauge({ sessionId }: { sessionId: string }) {
  const totals = useLiveConfusion(sessionId, 60);
  const total = Object.values(totals).reduce((a, b) => a + b, 0);

  return (
    <div className="border-divider flex flex-col gap-3 border-b px-6 py-4">
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
    </div>
  );
}
