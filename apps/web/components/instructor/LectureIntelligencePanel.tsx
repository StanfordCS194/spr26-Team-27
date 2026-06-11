"use client";

import { Badge } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { publishConceptCheck } from "@/lib/actions/instructor";
import {
  buildConfusionMoments,
  buildLectureSummary,
  generateConceptCheck,
} from "@/lib/classroom-intelligence";
import { useLiveConfusionEvents } from "@/lib/realtime/useLiveConfusionEvents";
import { useLiveQuestions } from "@/lib/realtime/useLiveQuestions";
import { useLiveTranscript } from "@/lib/realtime/useLiveTranscript";
import { useMemo, useState, useTransition } from "react";
import {
  MdDone,
  MdInsights,
  MdMyLocation,
  MdQuiz,
  MdSend,
  MdSummarize,
} from "react-icons/md";

export function LectureIntelligencePanel({ sessionId }: { sessionId: string }) {
  const transcript = useLiveTranscript(sessionId);
  const questions = useLiveQuestions(sessionId);
  const confusionEvents = useLiveConfusionEvents(sessionId);

  const moments = useMemo(
    () =>
      buildConfusionMoments({
        signals: confusionEvents,
        transcript,
        windowSeconds: 15 * 60,
      }),
    [confusionEvents, transcript],
  );

  const summary = useMemo(
    () => buildLectureSummary({ transcript, questions, moments }),
    [moments, questions, transcript],
  );

  const conceptCheck = useMemo(
    () => generateConceptCheck(transcript, moments),
    [moments, transcript],
  );

  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-1.5">
            <MdInsights className="text-primary-accent h-4 w-4" />
            Lecture intelligence
          </span>
        }
        right={<span>{confusionEvents.length} signals</span>}
      />
      <CardBody>
        <div className="flex max-h-[560px] flex-col gap-4 overflow-y-auto px-4 py-4">
          <ConfusionMoments moments={moments} />
          <ConceptCheckDraft
            key={`${conceptCheck.prompt}:${conceptCheck.choices.join("|")}`}
            sessionId={sessionId}
            prompt={conceptCheck.prompt}
            choices={conceptCheck.choices}
            disabled={transcript.length === 0}
          />
          <PostLectureRecap
            mainConcepts={summary.mainConcepts}
            suggestedReview={summary.suggestedReview}
            questionThemes={summary.questionThemes.map((theme) => theme.title)}
          />
        </div>
      </CardBody>
    </Card>
  );
}

function ConfusionMoments({
  moments,
}: {
  moments: ReturnType<typeof buildConfusionMoments>;
}) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-primary text-xs font-semibold tracking-widest uppercase">
          Confusion moments
        </h4>
        <Badge tone={moments.length === 0 ? "neutral" : "warning"}>
          {moments.length === 0 ? "none" : `${moments.length} clusters`}
        </Badge>
      </div>
      {moments.length === 0 ? (
        <p className="text-secondary text-xs leading-5">
          Student quick-prompt taps will cluster here by the transcript moment
          they were reacting to.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {moments.map((moment) => (
            <li
              key={moment.key}
              className="border-divider bg-primary-bg/50 rounded-lg border p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-primary truncate text-sm font-semibold">
                    {moment.concept}
                  </p>
                  <p className="text-secondary mt-1 text-xs">
                    {moment.count} signals · mostly {moment.promptLabel}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => jumpToTranscript(moment.timestampSeconds)}
                  title="Jump to the transcript moment"
                  className="text-primary-accent-dark hover:bg-primary-tint/50 inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold transition"
                >
                  <MdMyLocation className="h-3.5 w-3.5" />
                  {moment.timestamp}
                </button>
              </div>
              <p className="text-secondary mt-2 line-clamp-2 text-xs leading-5">
                {moment.transcriptSnippet}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ConceptCheckDraft({
  sessionId,
  prompt,
  choices,
  disabled,
}: {
  sessionId: string;
  prompt: string;
  choices: string[];
  disabled: boolean;
}) {
  const [draftPrompt, setDraftPrompt] = useState(prompt);
  const [draftChoices, setDraftChoices] = useState(choices.join("\n"));
  const [published, setPublished] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const onPublish = () => {
    setError(null);
    setPublished(false);
    startTransition(() => {
      void publishConceptCheck(sessionId, draftPrompt, draftChoices.split("\n"))
        .then(() => setPublished(true))
        .catch((err) => {
          setError(err instanceof Error ? err.message : "Publish failed");
        });
    });
  };

  return (
    <section className="flex flex-col gap-2">
      <h4 className="text-primary flex items-center gap-1.5 text-xs font-semibold tracking-widest uppercase">
        <MdQuiz className="text-primary-accent h-4 w-4" />
        Suggested concept check
      </h4>
      <textarea
        value={draftPrompt}
        onChange={(e) => setDraftPrompt(e.target.value)}
        disabled={disabled}
        className="border-divider focus:outline-primary-accent min-h-16 resize-none rounded-lg border px-3 py-2 text-sm leading-5 disabled:opacity-50"
      />
      <textarea
        value={draftChoices}
        onChange={(e) => setDraftChoices(e.target.value)}
        disabled={disabled}
        aria-label="Answer choices, one per line"
        className="border-divider focus:outline-primary-accent min-h-24 resize-none rounded-lg border px-3 py-2 text-xs leading-5 disabled:opacity-50"
      />
      <div className="flex items-center justify-between gap-2">
        <p className="text-secondary text-[11px]">
          Edit before publishing. Choices are one per line.
        </p>
        <button
          type="button"
          onClick={onPublish}
          disabled={disabled || pending}
          className="bg-primary-accent hover:bg-primary-accent-dark inline-flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-40"
        >
          {published ? (
            <MdDone className="h-3.5 w-3.5" />
          ) : (
            <MdSend className="h-3.5 w-3.5" />
          )}
          {published ? "Published" : pending ? "Publishing..." : "Publish"}
        </button>
      </div>
      {error ? (
        <p className="rounded-md bg-red-50 px-2 py-1.5 text-xs text-red-700">
          {error}
        </p>
      ) : null}
    </section>
  );
}

function PostLectureRecap({
  mainConcepts,
  suggestedReview,
  questionThemes,
}: {
  mainConcepts: readonly string[];
  suggestedReview: readonly string[];
  questionThemes: readonly string[];
}) {
  return (
    <section className="flex flex-col gap-2">
      <h4 className="text-primary flex items-center gap-1.5 text-xs font-semibold tracking-widest uppercase">
        <MdSummarize className="text-primary-accent h-4 w-4" />
        Recap seed
      </h4>
      <div className="border-divider bg-primary-bg/50 rounded-lg border p-3">
        <p className="text-secondary text-xs leading-5">
          {mainConcepts.length === 0
            ? "A post-lecture recap will appear once transcript lines arrive."
            : `Detected ${mainConcepts.length} recurring concepts and ${questionThemes.length} question themes.`}
        </p>
        {mainConcepts.length > 0 ? (
          <div className="mt-3 grid gap-3">
            <RecapList title="Main concepts" items={mainConcepts} />
            <RecapList title="Question themes" items={questionThemes} />
          </div>
        ) : null}
        {suggestedReview.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {suggestedReview.map((item) => (
              <span
                key={item}
                className="bg-primary-tint text-primary-accent-dark rounded-full px-2 py-1 text-[11px] font-semibold"
              >
                {item}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function RecapList({
  title,
  items,
}: {
  title: string;
  items: readonly string[];
}) {
  if (items.length === 0) return null;

  return (
    <div>
      <p className="text-secondary text-[10px] font-semibold tracking-widest uppercase">
        {title}
      </p>
      <ul className="mt-1 flex flex-col gap-1">
        {items.slice(0, 4).map((item) => (
          <li key={item} className="text-primary text-xs leading-5">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function jumpToTranscript(timestampSeconds: number) {
  const el = document.getElementById(`transcript-${timestampSeconds}`);
  el?.scrollIntoView({ behavior: "smooth", block: "center" });
  el?.classList.add("bg-primary-tint/50");
  window.setTimeout(() => {
    el?.classList.remove("bg-primary-tint/50");
  }, 1500);
}
