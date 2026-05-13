"use client";

import type { CitationManifest, MaterialCitation } from "@/lib/qa";
import type { ReactNode } from "react";

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
}: {
  manifest: CitationManifest | undefined;
}) {
  if (!manifest || manifest.materials.length === 0) return null;
  return (
    <div className="border-divider bg-primary-bg/40 mt-4 flex flex-col gap-1.5 rounded-lg border p-3 text-xs">
      <p className="text-secondary mb-1 text-[10px] font-semibold tracking-widest uppercase">
        Course material citations
      </p>
      {manifest.materials.map((c) => (
        <div key={c.n} className="flex items-start gap-2">
          <span className="bg-secondary-tint text-secondary-accent-dark mt-0.5 inline-flex h-4 w-6 shrink-0 items-center justify-center rounded text-[10px] font-semibold">
            M{c.n}
          </span>
          <span className="text-secondary">
            {c.materialTitle}
            {c.pageNumber !== null ? ` · p${c.pageNumber}` : ""}
          </span>
        </div>
      ))}
    </div>
  );
}
