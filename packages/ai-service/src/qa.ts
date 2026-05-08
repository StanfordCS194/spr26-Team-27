import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import {
  courseMaterialChunks,
  courseMaterials,
  transcriptItems,
  type CourseMaterial,
  type CourseMaterialChunk,
  type Database,
  type TranscriptItem,
} from "@spr26/db";
import { streamText, type LanguageModel } from "ai";
import { and, eq, isNotNull, lt, or, sql } from "drizzle-orm";
import { embedQuery } from "./embed.ts";

export const ANTHROPIC_MODEL = "claude-opus-4-7";
export const OPENAI_MODEL = "gpt-5.5";
export const GOOGLE_MODEL = "gemini-2.5-flash";

function selectModel(): LanguageModel {
  if (process.env.ANTHROPIC_API_KEY) return anthropic(ANTHROPIC_MODEL);
  if (process.env.OPENAI_API_KEY) return openai(OPENAI_MODEL);
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) return google(GOOGLE_MODEL);
  throw new Error(
    "set ANTHROPIC_API_KEY, OPENAI_API_KEY, or GOOGLE_GENERATIVE_AI_API_KEY to use the QA endpoint",
  );
}

// pgvector accepts the JS array as a string literal cast to ::vector. The
// postgres-js driver doesn't ship a native binding for the type.
function toVectorLiteral(vec: number[]): string {
  return `[${vec.join(",")}]`;
}

export interface StreamAnswerInput {
  db: Database;
  sessionId: string;
  courseId: string;
  question: string;
  /** Only transcript lines with timestamp_seconds < this are eligible. */
  uptoSeconds: number;
  kTranscript?: number;
  kMaterials?: number;
  neighborWindow?: number;
}

export interface CitationDraft {
  kind: "transcript" | "material";
  /** transcript_items.id OR course_material_chunks.id depending on kind */
  id: string;
  snippet: string;
}

export interface RetrievedContext {
  transcriptLines: TranscriptItem[];
  materialChunks: { chunk: CourseMaterialChunk; material: CourseMaterial }[];
}

export interface StreamAnswerDone {
  cleanedText: string;
  citations: CitationDraft[];
  retrieved: RetrievedContext;
}

export type StreamAnswerYield =
  | { delta: string }
  | { done: StreamAnswerDone };

const SYSTEM_PROMPT = `You are InLecture's study assistant. Answer ONLY using the provided lecture transcript and course materials.

Every factual claim MUST be grounded with an inline citation tag of the exact form:
  <cite id="UUID" snippet="exact short quote"/>

Use the UUID from the id="..." attribute of the <transcript_line> or <material_chunk> you are quoting from. NEVER invent a UUID. The snippet must be a short verbatim substring of that source.

If the answer is not in the provided context, reply exactly: "I don't see this in the lecture or materials yet."

Keep answers under 6 sentences unless the question demands more. No preamble.`;

function formatTs(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
    : `${m}:${String(sec).padStart(2, "0")}`;
}

function escapeXml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function buildPrompt(question: string, ctx: RetrievedContext): string {
  const transcriptBlock = ctx.transcriptLines
    .map(
      (l) =>
        `<transcript_line id="${l.id}" t="${formatTs(l.timestampSeconds)}">${escapeXml(l.content)}</transcript_line>`,
    )
    .join("\n");
  const materialBlock = ctx.materialChunks
    .map(
      ({ chunk, material }) =>
        `<material_chunk id="${chunk.id}" page="${chunk.pageNumber ?? ""}" title="${escapeXml(material.title)}">${escapeXml(chunk.content)}</material_chunk>`,
    )
    .join("\n");
  return `<context>
<transcript>
${transcriptBlock || "(no transcript yet)"}
</transcript>
<materials>
${materialBlock || "(no materials uploaded)"}
</materials>
</context>

Question: ${question}`;
}

const CITE_RE = /<cite\s+id="([^"]+)"\s+snippet="([^"]*)"\s*\/>/g;

async function retrieve(input: StreamAnswerInput): Promise<RetrievedContext> {
  const {
    db,
    sessionId,
    courseId,
    question,
    uptoSeconds,
    kTranscript = 8,
    kMaterials = 4,
    neighborWindow = 3,
  } = input;

  const qVec = toVectorLiteral(await embedQuery(question));

  // 1) Top-K transcript anchors, time-bounded, embeddings only.
  const anchors = await db
    .select()
    .from(transcriptItems)
    .where(
      and(
        eq(transcriptItems.sessionId, sessionId),
        lt(transcriptItems.timestampSeconds, uptoSeconds),
        isNotNull(transcriptItems.embedding),
      ),
    )
    .orderBy(sql`${transcriptItems.embedding} <=> ${qVec}::vector`)
    .limit(kTranscript);

  // 2) Pull ±N neighbors by sequence in one OR'd query, dedupe + sort by seq.
  let transcriptLines: TranscriptItem[] = [];
  if (anchors.length > 0) {
    const ranges = anchors.map((a) =>
      and(
        eq(transcriptItems.sessionId, sessionId),
        sql`${transcriptItems.sequence} BETWEEN ${a.sequence - neighborWindow} AND ${a.sequence + neighborWindow}`,
      ),
    );
    const rows = await db
      .select()
      .from(transcriptItems)
      .where(or(...ranges));
    const seen = new Set<string>();
    transcriptLines = rows
      .filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)))
      .sort((a, b) => a.sequence - b.sequence);
  }

  // 3) Top-K material chunks for the parent course.
  const matRows = await db
    .select({ chunk: courseMaterialChunks, material: courseMaterials })
    .from(courseMaterialChunks)
    .innerJoin(
      courseMaterials,
      eq(courseMaterialChunks.courseMaterialId, courseMaterials.id),
    )
    .where(
      and(
        eq(courseMaterials.courseId, courseId),
        isNotNull(courseMaterialChunks.embedding),
      ),
    )
    .orderBy(sql`${courseMaterialChunks.embedding} <=> ${qVec}::vector`)
    .limit(kMaterials);

  return { transcriptLines, materialChunks: matRows };
}

/**
 * Async-generator over { delta } SSE frames. The FINAL yield carries
 * { done: { cleanedText, citations, retrieved } } so callers can persist the
 * final answer + citations without re-running the model.
 */
export async function* streamAnswer(
  input: StreamAnswerInput,
): AsyncGenerator<StreamAnswerYield, void, unknown> {
  const retrieved = await retrieve(input);

  const result = streamText({
    model: selectModel(),
    system: SYSTEM_PROMPT,
    prompt: buildPrompt(input.question, retrieved),
    temperature: 0,
  });

  let buffer = "";
  for await (const delta of result.textStream) {
    buffer += delta;
    yield { delta };
  }

  // Validate cite ids against the retrieved set; drop any hallucinated ones.
  const transcriptIds = new Set(retrieved.transcriptLines.map((l) => l.id));
  const materialIds = new Set(retrieved.materialChunks.map((m) => m.chunk.id));
  const citations: CitationDraft[] = [];
  let n = 0;
  const cleanedText = buffer.replace(
    CITE_RE,
    (_full, id: string, snippet: string) => {
      let kind: "transcript" | "material" | null = null;
      if (transcriptIds.has(id)) kind = "transcript";
      else if (materialIds.has(id)) kind = "material";
      if (!kind) return "";
      n += 1;
      citations.push({ kind, id, snippet });
      return ` [${n}]`;
    },
  );

  yield { done: { cleanedText, citations, retrieved } };
}
