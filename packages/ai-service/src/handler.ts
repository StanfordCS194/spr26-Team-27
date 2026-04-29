import type { TranscriptItem } from "./qa.ts";

export interface QaRawInput {
  t: string | null;
  /** optional lower-bound (seconds). Lines with timestamp < f are excluded. */
  f?: string | null;
  question: string | null;
  transcript: TranscriptItem[];
}

export type QaParseResult =
  | {
      ok: true;
      uptoSeconds: number;
      fromSeconds?: number;
      question: string;
      transcript: TranscriptItem[];
    }
  | { ok: false; status: 400; error: string };

export function parseQaInput(input: QaRawInput): QaParseResult {
  if (input.t === null) {
    return { ok: false, status: 400, error: "missing t query param" };
  }
  const uptoSeconds = Number(input.t);
  if (!Number.isFinite(uptoSeconds)) {
    return { ok: false, status: 400, error: "t must be a number (seconds)" };
  }
  let fromSeconds: number | undefined;
  if (input.f !== null && input.f !== undefined && input.f !== "") {
    const parsed = Number(input.f);
    if (!Number.isFinite(parsed)) {
      return { ok: false, status: 400, error: "f must be a number (seconds)" };
    }
    fromSeconds = parsed;
  }
  if (!input.question) {
    return { ok: false, status: 400, error: "missing question" };
  }
  return {
    ok: true,
    uptoSeconds,
    fromSeconds,
    question: input.question,
    transcript: input.transcript,
  };
}
