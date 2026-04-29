import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import { streamText, type LanguageModel } from "ai";

export const ANTHROPIC_MODEL = "claude-opus-4-7";
export const OPENAI_MODEL = "gpt-5.5";

function selectModel(): LanguageModel {
  if (process.env.ANTHROPIC_API_KEY) return anthropic(ANTHROPIC_MODEL);
  if (process.env.OPENAI_API_KEY) return openai(OPENAI_MODEL);
  throw new Error(
    "set ANTHROPIC_API_KEY or OPENAI_API_KEY to use the QA endpoint",
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
  const result = streamText({
    model: selectModel(),
    system: SYSTEM_PROMPT,
    prompt: buildPrompt(input),
    temperature: 0,
  });
  for await (const delta of result.textStream) {
    yield delta;
  }
}
