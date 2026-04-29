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
  /** include only transcript lines whose timestamp (in seconds) is >= this value */
  fromSeconds?: number;
  question: string;
  abortSignal?: AbortSignal;
}

const SYSTEM_PROMPT = `You are a helpful study assistant embedded in a live lecture. The provided transcript is the source of truth for *what* is being taught right now — use it to determine the topic, the speaker's framing, and the level of abstraction the student is operating at.

Default behavior:
- For factual or "what did the professor say" questions, answer strictly from the transcript and reference timestamps when relevant.
- For pedagogical requests like "give an example", "re-explain that", or "what just happened", treat the recent transcript as the topic context and generate a fresh, illustrative response that fits that topic — fabricated examples are fine as long as they align with the concept the speaker is teaching. Do not refuse just because the transcript doesn't already contain an example.
- Never invent claims about what the professor specifically said. If you generate an example that goes beyond the transcript, frame it as your own (e.g. "Here's one way to think about it…") rather than attributing it to the lecture.

If the transcript truly doesn't give you enough to work with — e.g. the student's question is ambiguous or the recent context is too thin — ask a short clarifying question instead of saying "I don't know". Never reply with "I don't know" alone.

Keep answers concise.`;

function buildPrompt({
  transcript,
  uptoSeconds,
  fromSeconds,
  question,
}: AnswerQuestionInput): string {
  const lower = fromSeconds ?? 0;
  const visible = transcript.filter((line) => {
    const ts = parseTimestamp(line.timestamp);
    return ts >= lower && ts < uptoSeconds;
  });
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
