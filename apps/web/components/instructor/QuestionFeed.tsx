"use client";

import { EmptyState } from "@/components/in-lecture/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { markQuestionAnswered } from "@/lib/actions/instructor";
import {
  clusterQuestions,
  type QuestionCluster,
} from "@/lib/classroom-intelligence";
import {
  useLiveQuestions,
  type LiveQuestion,
} from "@/lib/realtime/useLiveQuestions";
import { useLiveTranscript } from "@/lib/realtime/useLiveTranscript";
import { useMemo, useState, useTransition } from "react";
import {
  MdAccessTime,
  MdCheck,
  MdQuestionAnswer,
  MdTopic,
} from "react-icons/md";

type AnchorIndex = Record<
  string,
  { timestamp: string; timestampSeconds: number }
>;

export function QuestionFeed({ sessionId }: { sessionId: string }) {
  const questions = useLiveQuestions(sessionId);
  const transcript = useLiveTranscript(sessionId);

  const anchorIndex = useMemo<AnchorIndex>(() => {
    const map: AnchorIndex = {};
    for (const t of transcript) {
      map[t.id] = {
        timestamp: t.timestamp,
        timestampSeconds: t.timestampSeconds,
      };
    }
    return map;
  }, [transcript]);

  const clusters = useMemo(() => clusterQuestions(questions), [questions]);

  const openCount = questions.filter((q) => !q.answered_at).length;

  return (
    <Card className="h-full">
      <CardHeader
        title="Student questions"
        right={
          <span>
            {questions.length === 0
              ? "—"
              : `${openCount} open · ${questions.length} total`}
          </span>
        }
      />
      <CardBody>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {questions.length === 0 ? (
            <EmptyState
              icon={<MdQuestionAnswer />}
              title="No questions yet"
              description="Student questions land here in real time — both immediate asks and ones queued for after lecture."
            />
          ) : (
            <ul className="flex flex-col gap-2.5 px-4 py-4">
              {clusters.map((cluster) => (
                <QuestionClusterCard
                  key={cluster.key}
                  cluster={cluster}
                  anchorIndex={anchorIndex}
                />
              ))}
            </ul>
          )}
        </div>
      </CardBody>
    </Card>
  );
}

function QuestionClusterCard({
  cluster,
  anchorIndex,
}: {
  cluster: QuestionCluster;
  anchorIndex: AnchorIndex;
}) {
  const openCount = cluster.questions.filter((q) => !q.answered_at).length;

  return (
    <li className="border-divider bg-primary-bg/40 overflow-hidden rounded-xl border">
      <div className="border-divider flex items-start justify-between gap-3 border-b px-3.5 py-3">
        <div className="min-w-0">
          <p className="text-primary flex items-center gap-1.5 truncate text-sm font-semibold">
            <MdTopic className="text-primary-accent h-4 w-4 shrink-0" />
            {cluster.title}
          </p>
          <p className="text-secondary mt-1 text-xs">
            {openCount} open · {cluster.count} similar question
            {cluster.count === 1 ? "" : "s"}
          </p>
        </div>
        <Badge tone={cluster.count > 1 ? "accent" : "neutral"}>
          {cluster.count}x
        </Badge>
      </div>
      <ul className="flex flex-col divide-y divide-stone-200/80">
        {cluster.questions.map((q) => (
          <QuestionRow
            key={q.id}
            question={q}
            anchor={
              q.anchor_transcript_item_id
                ? anchorIndex[q.anchor_transcript_item_id]
                : undefined
            }
          />
        ))}
      </ul>
    </li>
  );
}

function QuestionRow({
  question,
  anchor,
}: {
  question: LiveQuestion;
  anchor?: { timestamp: string; timestampSeconds: number };
}) {
  const [pending, startTransition] = useTransition();
  // Optimistic local marker so the row demotes immediately on click — the
  // real flag lands when the realtime UPDATE arrives a tick later.
  const [optimisticAnswered, setOptimisticAnswered] = useState(false);
  const answered = Boolean(question.answered_at) || optimisticAnswered;

  const jumpToAnchor = () => {
    if (!anchor) return;
    const el = document.getElementById(`transcript-${anchor.timestampSeconds}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    el?.classList.add("bg-primary-tint/50");
    window.setTimeout(() => {
      el?.classList.remove("bg-primary-tint/50");
    }, 1500);
  };

  const onMarkAnswered = () => {
    if (answered) return;
    setOptimisticAnswered(true);
    startTransition(() => {
      void markQuestionAnswered(question.id).catch((err) => {
        console.error("markQuestionAnswered failed", err);
        setOptimisticAnswered(false);
      });
    });
  };

  return (
    <li className={`px-3.5 py-3 transition ${answered ? "opacity-50" : ""}`}>
      <div className="flex items-center justify-between gap-2 pb-2">
        <div className="flex items-center gap-1.5">
          <Badge tone={question.mode === "immediate" ? "accent" : "warning"}>
            {question.mode}
          </Badge>
          {anchor && (
            <button
              type="button"
              onClick={jumpToAnchor}
              title="Jump to this line in the transcript"
              className="border-divider text-primary-accent-dark hover:bg-primary-tint/40 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[10px] tabular-nums transition"
            >
              <MdAccessTime className="h-3 w-3" />@{anchor.timestamp}
            </button>
          )}
        </div>
        <span className="text-secondary shrink-0 text-[11px]">
          {new Date(question.asked_at).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
      <p
        className={`text-sm leading-6 ${
          answered ? "text-secondary line-through" : "text-primary"
        }`}
      >
        {question.content}
      </p>
      {!answered && (
        <div className="pt-2">
          <button
            type="button"
            onClick={onMarkAnswered}
            disabled={pending}
            className="text-primary-accent-dark hover:bg-primary-tint/40 inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold transition disabled:opacity-40"
          >
            <MdCheck className="h-3.5 w-3.5" />
            Mark answered
          </button>
        </div>
      )}
    </li>
  );
}
