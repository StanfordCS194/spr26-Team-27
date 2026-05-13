import { db } from "@/lib/db";
import {
  courseMaterialChunks,
  courseMaterials,
  sessions,
  transcriptItems,
} from "@spr26/db";
import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import {
  embed,
  stepCountIs,
  streamText,
  tool,
  type LanguageModel,
} from "ai";
import { and, asc, eq, isNotNull, sql } from "drizzle-orm";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ANTHROPIC_MODEL = "claude-opus-4-7";
const OPENAI_MODEL = "gpt-5.5";
const EMBED_MODEL = "text-embedding-3-small";

const SYSTEM_PROMPT = `You are a study assistant for InLecture, embedded in a live lecture session.

The full transcript of today's lecture is provided inline below, with [HH:MM] timestamps prefixing each line. Answer the student's question using this transcript.

CITATION RULES (strict):
- When you reference something from the lecture transcript, cite the moment inline using its [HH:MM] timestamp from the transcript. Example: "The professor introduced convolutions [02:13] and walked through the dice example [05:08]."
- If you call search_course_materials, the tool returns numbered results like [M1], [M2]. Cite them in the answer using those exact labels.
- Never invent citations. Only cite timestamps or material labels that actually appear in your inputs.

If the answer isn't in the transcript or in returned materials, say so plainly. Keep answers concise.`;

interface MaterialCitation {
  n: number;
  materialId: string;
  materialTitle: string;
  chunkId: string;
  pageNumber: number | null;
  preview: string;
}

function selectModel(): LanguageModel {
  if (process.env.ANTHROPIC_API_KEY) return anthropic(ANTHROPIC_MODEL);
  if (process.env.OPENAI_API_KEY) return openai(OPENAI_MODEL);
  throw new Error("set ANTHROPIC_API_KEY or OPENAI_API_KEY");
}

function formatTs(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

async function handle(req: Request) {
  let question: string | undefined;
  let sessionId: string | undefined;

  if (req.method === "GET") {
    const url = new URL(req.url);
    question = url.searchParams.get("q") ?? undefined;
    sessionId = url.searchParams.get("sessionId") ?? undefined;
  } else {
    try {
      const body = (await req.json()) as {
        question?: string;
        sessionId?: string;
      };
      question = body.question;
      sessionId = body.sessionId;
    } catch {
      return Response.json({ error: "invalid JSON body" }, { status: 400 });
    }
  }

  if (!question?.trim()) {
    return Response.json({ error: "question is required" }, { status: 400 });
  }
  if (!sessionId) {
    return Response.json({ error: "sessionId is required" }, { status: 400 });
  }

  // Resolve courseId from sessionId so we know where to look for materials.
  const [sessionRow] = await db()
    .select({ courseId: sessions.courseId })
    .from(sessions)
    .where(eq(sessions.id, sessionId));
  if (!sessionRow) {
    return Response.json({ error: "session not found" }, { status: 404 });
  }
  const courseId = sessionRow.courseId;

  // Pull the entire transcript inline. For a typical lecture (~50min) this
  // is ~10k tokens — well within Claude Opus's window.
  const transcript = await db()
    .select({
      sequence: transcriptItems.sequence,
      timestampSeconds: transcriptItems.timestampSeconds,
      content: transcriptItems.content,
    })
    .from(transcriptItems)
    .where(eq(transcriptItems.sessionId, sessionId))
    .orderBy(asc(transcriptItems.sequence));

  const transcriptBlock =
    transcript.length === 0
      ? "<transcript>\n(no transcript captured yet)\n</transcript>"
      : `<transcript>\n${transcript
          .map((r) => `[${formatTs(r.timestampSeconds)}] ${r.content}`)
          .join("\n")}\n</transcript>`;

  const materialCitations: MaterialCitation[] = [];

  // Optional tool — searches uploaded course materials via pgvector. Returns
  // empty when nothing's been uploaded for this course yet.
  const searchCourseMaterials = tool({
    description:
      "Semantic search over course materials uploaded for this class (slides, notes, readings). Use when the question references content that may live in those materials rather than today's transcript. Returns numbered [M1], [M2]... results.",
    inputSchema: z.object({
      query: z.string().describe("Focused search query."),
      k: z.number().int().min(1).max(8).default(4),
    }),
    execute: async ({ query, k }) => {
      if (!process.env.OPENAI_API_KEY) {
        return { results: [], note: "OPENAI_API_KEY not set" };
      }
      const { embedding } = await embed({
        model: openai.embedding(EMBED_MODEL),
        value: query,
      });
      const vec = `[${embedding.join(",")}]`;

      const hits = await db()
        .select({
          chunkId: courseMaterialChunks.id,
          materialId: courseMaterialChunks.courseMaterialId,
          chunkIndex: courseMaterialChunks.chunkIndex,
          content: courseMaterialChunks.content,
          pageNumber: courseMaterialChunks.pageNumber,
          materialTitle: courseMaterials.title,
        })
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
        .orderBy(sql`${courseMaterialChunks.embedding} <=> ${vec}::vector`)
        .limit(k);

      if (hits.length === 0) {
        return {
          results: [],
          note: "No course materials uploaded yet for this course.",
        };
      }

      const results = hits.map((h) => {
        const n = materialCitations.length + 1;
        materialCitations.push({
          n,
          materialId: h.materialId,
          materialTitle: h.materialTitle,
          chunkId: h.chunkId,
          pageNumber: h.pageNumber,
          preview: h.content.slice(0, 200),
        });
        return {
          label: `[M${n}]`,
          title: h.materialTitle,
          page: h.pageNumber,
          content: h.content,
        };
      });
      return { results };
    },
  });

  const model = selectModel();
  const result = streamText({
    model,
    system: SYSTEM_PROMPT,
    prompt: `${transcriptBlock}\n\nStudent question: ${question}`,
    temperature: 0,
    tools: { search_course_materials: searchCourseMaterials },
    stopWhen: stepCountIs(4),
  });

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const part of result.fullStream) {
          if (part.type === "text-delta") {
            const delta =
              (part as { textDelta?: string; text?: string }).textDelta ??
              (part as { text?: string }).text ??
              "";
            if (!delta) continue;
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ delta })}\n\n`),
            );
          } else if (part.type === "tool-call") {
            const p = part as unknown as {
              toolCallId: string;
              toolName: string;
              args?: Record<string, unknown>;
              input?: Record<string, unknown>;
            };
            controller.enqueue(
              encoder.encode(
                `event: tool_call\ndata: ${JSON.stringify({
                  id: p.toolCallId,
                  name: p.toolName,
                  args: p.args ?? p.input ?? {},
                })}\n\n`,
              ),
            );
          } else if (part.type === "tool-result") {
            const p = part as unknown as {
              toolCallId: string;
              toolName: string;
              output?: { results?: unknown[] };
              result?: { results?: unknown[] };
            };
            const out = p.output ?? p.result ?? {};
            const count = Array.isArray(out.results) ? out.results.length : 0;
            controller.enqueue(
              encoder.encode(
                `event: tool_result\ndata: ${JSON.stringify({
                  id: p.toolCallId,
                  name: p.toolName,
                  count,
                })}\n\n`,
              ),
            );
          } else if (part.type === "error") {
            const p = part as unknown as { error?: unknown };
            const msg =
              p.error instanceof Error ? p.error.message : String(p.error);
            controller.enqueue(
              encoder.encode(
                `event: error\ndata: ${JSON.stringify({ error: msg })}\n\n`,
              ),
            );
          }
        }

        controller.enqueue(
          encoder.encode(
            `event: citations\ndata: ${JSON.stringify({
              materials: materialCitations,
            })}\n\n`,
          ),
        );
        controller.enqueue(encoder.encode(`event: done\ndata: "[DONE]"\n\n`));
      } catch (err) {
        const msg = err instanceof Error ? err.message : "internal error";
        controller.enqueue(
          encoder.encode(
            `event: error\ndata: ${JSON.stringify({ error: msg })}\n\n`,
          ),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}

export const GET = handle;
export const POST = handle;
