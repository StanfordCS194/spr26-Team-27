import type { TranscriptItem } from "./qa.ts";

export interface QaRawInput {
  t: string | null;
  question: string | null;
  transcript: TranscriptItem[];
}

export type QaParseResult =
  | {
      ok: true;
      uptoSeconds: number;
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
  if (!input.question) {
    return { ok: false, status: 400, error: "missing question" };
  }
  return {
    ok: true,
    uptoSeconds,
    question: input.question,
    transcript: input.transcript,
  };
}
