"use client";

/* eslint-disable react-refresh/only-export-components */

import type { CitationManifest, MaterialCitation } from "@/lib/qa";
import type { ReactNode } from "react";

interface TranscriptCitation {
  label: string;
  totalSeconds: number;
  preview?: string;
}

interface TranscriptLine {
  timestamp: string;
  content: string;
  timestampSeconds?: number;
}

// Two citation formats live in the answer text:
//   [HH:MM]  → transcript moment (rendered as a pin that links to that line)
//   [Mn]     → course-material chunk N (looked up in the manifest)
const CITATION_RE = /\[(?:(\d{1,2}):(\d{2})|M(\d+))\]/g;

export function renderWithCitations(
  text: string,
  manifest: CitationManifest | undefined,
): ReactNode[] {
  const materialsByN = new Map<number, MaterialCitation>(
    manifest?.materials.map((m) => [m.n, m]) ?? [],
  );
  const out: ReactNode[] = [];
  let lastIdx = 0;
  let m: RegExpExecArray | null;
  // Reset the regex's lastIndex since /g state persists across calls.
  CITATION_RE.lastIndex = 0;
  while ((m = CITATION_RE.exec(text)) !== null) {
    if (m.index > lastIdx) out.push(text.slice(lastIdx, m.index));
    if (m[1] && m[2]) {
      const minutes = Number.parseInt(m[1], 10);
      const seconds = Number.parseInt(m[2], 10);
      const total = minutes * 60 + seconds;
      out.push(
        <TranscriptPin
          key={`t-${m.index}`}
          label={`${m[1]}:${m[2]}`}
          totalSeconds={total}
        />,
      );
    } else if (m[3]) {
      const n = Number.parseInt(m[3], 10);
      const mat = materialsByN.get(n);
      if (mat) {
        out.push(<MaterialPin key={`m-${m.index}-${n}`} citation={mat} />);
      } else {
        out.push(`[M${n}]`);
      }
    }
    lastIdx = m.index + m[0].length;
  }
  if (lastIdx < text.length) out.push(text.slice(lastIdx));
  return out;
}

function TranscriptPin({
  label,
  totalSeconds,
}: {
  label: string;
  totalSeconds: number;
}) {
  return (
    <a
      href={`#transcript-${totalSeconds}`}
      onClick={(e) => {
        e.preventDefault();
        const el = document.getElementById(`transcript-${totalSeconds}`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          el.classList.add("ring-2", "ring-primary-accent");
          window.setTimeout(
            () => el.classList.remove("ring-2", "ring-primary-accent"),
            1500,
          );
        }
      }}
      className="bg-primary-tint text-primary-accent-dark hover:bg-primary-accent mx-0.5 inline-flex items-center rounded px-1.5 py-0.5 align-baseline font-mono text-[10px] font-semibold no-underline transition hover:text-white"
      title={`Lecture transcript at ${label}`}
    >
      {label}
    </a>
  );
}

function MaterialPin({ citation }: { citation: MaterialCitation }) {
  const pageSuffix =
    citation.pageNumber !== null ? ` · p${citation.pageNumber}` : "";
  return (
    <span
      className="bg-secondary-tint text-secondary-accent-dark mx-0.5 inline-flex items-center rounded px-1.5 py-0.5 align-baseline text-[10px] font-semibold"
      title={`${citation.materialTitle}${pageSuffix}`}
    >
      M{citation.n}
    </span>
  );
}

export function SourcesTray({
  manifest,
  answerText,
  transcriptLines = [],
}: {
  manifest: CitationManifest | undefined;
  answerText?: string;
  transcriptLines?: readonly TranscriptLine[];
}) {
  const transcriptCitations = extractTranscriptCitations(
    answerText ?? "",
    transcriptLines,
  );
  const materialCitations = manifest?.materials ?? [];

  if (materialCitations.length === 0 && transcriptCitations.length === 0) {
    return null;
  }

  return (
    <div className="border-divider bg-primary-bg/40 mt-4 flex flex-col gap-1.5 rounded-lg border p-3 text-xs">
      {transcriptCitations.length > 0 ? (
        <SourceGroup title="Transcript citations">
          {transcriptCitations.map((c) => (
            <button
              key={c.totalSeconds}
              type="button"
              onClick={() => jumpToTranscript(c.totalSeconds)}
              className="hover:bg-primary-tint/40 flex items-start gap-2 rounded-md p-1 text-left transition"
            >
              <span className="bg-primary-tint text-primary-accent-dark mt-0.5 inline-flex h-5 min-w-10 shrink-0 items-center justify-center rounded font-mono text-[10px] font-semibold">
                {c.label}
              </span>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-primary text-xs">
                  Live transcript moment
                </span>
                <span className="text-secondary line-clamp-2 text-[11px] leading-4">
                  {c.preview ??
                    "Used because the answer cites this point in the lecture."}
                </span>
              </span>
            </button>
          ))}
        </SourceGroup>
      ) : null}

      {materialCitations.length > 0 ? (
        <SourceGroup title="Course material citations">
          {materialCitations.map((c) => (
            <div key={c.n} className="flex items-start gap-2 rounded-md p-1">
              <span className="bg-secondary-tint text-secondary-accent-dark mt-0.5 inline-flex h-5 w-7 shrink-0 items-center justify-center rounded text-[10px] font-semibold">
                M{c.n}
              </span>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-primary text-xs">
                  {c.materialTitle}
                  {c.pageNumber !== null ? ` · p${c.pageNumber}` : ""}
                </span>
                <span className="text-secondary line-clamp-2 text-[11px] leading-4">
                  {c.preview ||
                    "Used because this course material matched the question."}
                </span>
              </span>
            </div>
          ))}
        </SourceGroup>
      ) : null}
    </div>
  );
}

function SourceGroup({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-secondary text-[10px] font-semibold tracking-widest uppercase">
        {title}
      </p>
      {children}
    </div>
  );
}

function extractTranscriptCitations(
  answerText: string,
  transcriptLines: readonly TranscriptLine[],
): TranscriptCitation[] {
  const out = new Map<number, TranscriptCitation>();
  let m: RegExpExecArray | null;
  CITATION_RE.lastIndex = 0;
  while ((m = CITATION_RE.exec(answerText)) !== null) {
    if (!m[1] || !m[2]) continue;
    const minutes = Number.parseInt(m[1], 10);
    const seconds = Number.parseInt(m[2], 10);
    const totalSeconds = minutes * 60 + seconds;
    const line = findTranscriptLine(transcriptLines, totalSeconds);
    out.set(totalSeconds, {
      label: `${m[1]}:${m[2]}`,
      totalSeconds,
      preview: line?.content,
    });
  }
  return [...out.values()].sort((a, b) => a.totalSeconds - b.totalSeconds);
}

function findTranscriptLine(
  lines: readonly TranscriptLine[],
  totalSeconds: number,
): TranscriptLine | undefined {
  return lines.find((line) => {
    const seconds = line.timestampSeconds ?? timestampToSeconds(line.timestamp);
    return Math.abs(seconds - totalSeconds) <= 3;
  });
}

function timestampToSeconds(timestamp: string): number {
  const [m, s] = timestamp.split(":").map((part) => Number.parseInt(part, 10));
  return (m || 0) * 60 + (s || 0);
}

function jumpToTranscript(totalSeconds: number) {
  const el = document.getElementById(`transcript-${totalSeconds}`);
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("ring-2", "ring-primary-accent");
    window.setTimeout(
      () => el.classList.remove("ring-2", "ring-primary-accent"),
      1500,
    );
  }
}
