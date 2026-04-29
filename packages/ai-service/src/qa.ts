import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import { streamText, type LanguageModel } from "ai";

export const ANTHROPIC_MODEL = "claude-opus-4-7";
export const OPENAI_MODEL = "gpt-4o-mini";

// Mocking is the default only when no provider key is configured. Once a key
// is present we switch to the real model unless QA_MOCK=1 is set explicitly.
// Evaluated per-request so env vars loaded after this module is imported
// (e.g. by vite.config.ts before plugins run) are still picked up.
function isMockEnabled(): boolean {
  if (process.env.QA_MOCK === "0") return false;
  if (process.env.QA_MOCK === "1") return true;
  return !process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY;
}
const MOCK_ANSWER = "Here is an answer to your question for example.";
// Stream the canned answer in small chunks so the SSE pipeline behaves the
// same as a real model — the streaming UX is visible, abort works, etc.
const MOCK_CHUNK_MS = 60;

function selectModel(): LanguageModel {
  if (process.env.OPENAI_API_KEY) return openai(OPENAI_MODEL);
  if (process.env.ANTHROPIC_API_KEY) return anthropic(ANTHROPIC_MODEL);
  throw new Error(
    "set OPENAI_API_KEY or ANTHROPIC_API_KEY to use the QA endpoint",
  );
}

export interface TranscriptItem {
  timestamp: string;
  content: string;
}

export function parseTimestamp(ts: string): number {
  const parts = ts.split(":").map((p) => Number.parseInt(p, 10));
  if (parts.some(Number.isNaN)) {
    throw new Error(`invalid timestamp: ${ts}`);
  }
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  throw new Error(`invalid timestamp: ${ts}`);
}

export interface AnswerQuestionInput {
  transcript: TranscriptItem[];
  /** include only transcript lines whose timestamp (in seconds) is < this value */
  uptoSeconds: number;
  question: string;
  abortSignal?: AbortSignal;
}

const SYSTEM_PROMPT =
  "You are a helpful study assistant. Answer the student's question using only the lecture transcript provided. If the answer is not in the transcript, say you don't know. Keep answers concise and reference timestamps when relevant.";

function buildPrompt({
  transcript,
  uptoSeconds,
  question,
}: AnswerQuestionInput) {
  const visible = transcript.filter(
    (line) => parseTimestamp(line.timestamp) < uptoSeconds,
  );
  const transcriptText = visible
    .map((l) => `[${l.timestamp}] ${l.content}`)
    .join("\n");
  return `<transcript>
${transcriptText}
</transcript>

Question: ${question}`;
}

/** Streams text deltas as they arrive from the model. */
export async function* streamAnswer(
  input: AnswerQuestionInput,
): AsyncIterable<string> {
  if (isMockEnabled()) {
    yield* mockAnswer(input.abortSignal);
    return;
  }

  const result = streamText({
    model: selectModel(),
    system: SYSTEM_PROMPT,
    prompt: buildPrompt(input),
    temperature: 0,
    abortSignal: input.abortSignal,
  });
  for await (const delta of result.textStream) {
    yield delta;
  }
}

async function* mockAnswer(
  signal?: AbortSignal,
): AsyncGenerator<string, void, void> {
  for (const chunk of MOCK_ANSWER.match(/\S+\s*/g) ?? []) {
    if (signal?.aborted) return;
    await abortableSleep(MOCK_CHUNK_MS, signal);
    yield chunk;
  }
}

function abortableSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      resolve();
    });
  });
}
