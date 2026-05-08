import { randomUUID } from "node:crypto";
import {
  answers,
  citations,
  courseMaterialChunks,
  courseMaterials,
  createDb,
  questions,
  sessions,
  transcriptItems,
  type Database,
} from "@spr26/db";
import {
  embedDocuments,
  streamAnswer,
  type CitationDraft,
} from "@spr26/ai-service";
import { createClient } from "@supabase/supabase-js";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { extractText } from "unpdf";
import { z } from "zod";

// Process-singleton DB. postgres-js pools internally so caching the drizzle
// client is correct.
let dbInstance: Database | undefined;
function getDb(): Database {
  if (dbInstance) return dbInstance;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  dbInstance = createDb(url);
  return dbInstance;
}

const STORAGE_BUCKET = "course-materials";

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  }
  return createClient(url, key);
}

// Char-based proxy: ~4 chars per token. Boundaries prefer paragraph, then
// sentence, then word. Inline because there's exactly one caller.
function splitIntoChunks(
  text: string,
  targetTokens = 800,
  overlapTokens = 100,
): string[] {
  const target = targetTokens * 4;
  const overlap = overlapTokens * 4;
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (trimmed.length <= target) return [trimmed];

  const out: string[] = [];
  let i = 0;
  while (i < trimmed.length) {
    const end = Math.min(i + target, trimmed.length);
    let cut = end;
    if (end < trimmed.length) {
      const window = trimmed.slice(i + Math.floor(target * 0.8), end);
      const p = window.lastIndexOf("\n\n");
      const s = window.search(/[.?!]\s/);
      const w = window.lastIndexOf(" ");
      const off =
        p >= 0 ? p + 2 : s >= 0 ? s + 2 : w >= 0 ? w + 1 : window.length;
      cut = i + Math.floor(target * 0.8) + off;
    }
    const piece = trimmed.slice(i, cut).trim();
    if (piece) out.push(piece);
    if (cut >= trimmed.length) break;
    i = Math.max(cut - overlap, i + 1);
  }
  return out;
}

// ---------------------------------------------------------------------------

export const app = new Hono();

// 1) Instructor inflow: append live transcript lines to a session and embed
//    them inline. Idempotent on (session_id, sequence).
const transcriptBody = z.object({
  items: z
    .array(
      z.object({
        sequence: z.number().int().nonnegative(),
        timestampSeconds: z.number().int().nonnegative(),
        content: z.string().min(1),
      }),
    )
    .min(1)
    .max(500),
});

app.post("/api/sessions/:sessionId/transcript", async (c) => {
  const sessionId = c.req.param("sessionId");
  // TODO(auth): assert caller is the instructor of this session's course.
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON body" }, 400);
  }
  const parsed = transcriptBody.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.message }, 400);

  const embeddings = await embedDocuments(
    parsed.data.items.map((i) => i.content),
  );

  const inserted = await getDb()
    .insert(transcriptItems)
    .values(
      parsed.data.items.map((it, idx) => ({
        sessionId,
        sequence: it.sequence,
        timestampSeconds: it.timestampSeconds,
        content: it.content,
        embedding: embeddings[idx],
      })),
    )
    .onConflictDoNothing({
      target: [transcriptItems.sessionId, transcriptItems.sequence],
    })
    .returning({ id: transcriptItems.id, sequence: transcriptItems.sequence });

  return c.json({ inserted });
});

// 2) Instructor materials upload: PDF -> Supabase Storage -> unpdf per page ->
//    chunk -> embedDocuments -> insert courseMaterials + chunks atomically.
const materialKind = z.enum(["slide_deck", "note", "reading"]);

app.post("/api/courses/:courseId/materials", async (c) => {
  const courseId = c.req.param("courseId");
  // TODO(auth): assert caller is instructor of this course.
  let form: FormData;
  try {
    form = await c.req.formData();
  } catch {
    return c.json({ error: "expected multipart/form-data" }, 400);
  }
  const file = form.get("file");
  const title = form.get("title");
  const kindRaw = form.get("kind");
  if (!(file instanceof File)) return c.json({ error: "missing file" }, 400);
  if (typeof title !== "string" || !title.trim()) {
    return c.json({ error: "missing title" }, 400);
  }
  const kind = materialKind.safeParse(kindRaw);
  if (!kind.success) return c.json({ error: "invalid kind" }, 400);

  const buf = new Uint8Array(await file.arrayBuffer());
  const supabase = getSupabase();
  const objectKey = `${courseId}/${randomUUID()}.pdf`;
  const upload = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(objectKey, buf, {
      contentType: "application/pdf",
      upsert: false,
    });
  if (upload.error) {
    return c.json({ error: `storage upload failed: ${upload.error.message}` }, 500);
  }
  const { data: pub } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(objectKey);

  // unpdf with mergePages: false returns string[] (one entry per page).
  const { text } = await extractText(buf, { mergePages: false });
  const pages = Array.isArray(text) ? text : [text];

  const chunks: { content: string; pageNumber: number }[] = [];
  pages.forEach((pageText, i) => {
    for (const piece of splitIntoChunks(pageText)) {
      chunks.push({ content: piece, pageNumber: i + 1 });
    }
  });
  if (chunks.length === 0) {
    return c.json({ error: "no extractable text in PDF" }, 422);
  }

  const embeddings = await embedDocuments(chunks.map((c) => c.content));

  const result = await getDb().transaction(async (tx) => {
    const [material] = await tx
      .insert(courseMaterials)
      .values({
        courseId,
        kind: kind.data,
        title: title.trim(),
        sourceUrl: pub.publicUrl,
      })
      .returning();
    if (!material) throw new Error("failed to insert material");
    await tx.insert(courseMaterialChunks).values(
      chunks.map((ch, idx) => ({
        courseMaterialId: material.id,
        chunkIndex: idx,
        content: ch.content,
        pageNumber: ch.pageNumber,
        embedding: embeddings[idx],
      })),
    );
    return { material, chunkCount: chunks.length };
  });
  return c.json(result);
});

// 3) Student query: retrieve + stream + persist + cite-validate.
const qaBody = z.object({
  question: z.string().min(1),
  uptoSeconds: z.number().nonnegative(),
  mode: z.enum(["immediate", "deferred"]).default("immediate"),
  participantId: z.string().uuid(),
  anchorTranscriptItemId: z.string().uuid().optional(),
});

app.post("/api/sessions/:sessionId/qa", async (c) => {
  const sessionId = c.req.param("sessionId");
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON body" }, 400);
  }
  const parsed = qaBody.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.message }, 400);

  const db = getDb();
  const [session] = await db
    .select({ courseId: sessions.courseId })
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);
  if (!session) return c.json({ error: "session not found" }, 404);

  // Insert question + initial answer up front. Held outside the SSE loop so
  // we don't keep a Postgres tx open for the duration of the model stream.
  const [question] = await db
    .insert(questions)
    .values({
      sessionId,
      participantId: parsed.data.participantId,
      content: parsed.data.question,
      mode: parsed.data.mode,
      anchorTranscriptItemId: parsed.data.anchorTranscriptItemId ?? null,
    })
    .returning();
  if (!question) return c.json({ error: "failed to record question" }, 500);

  const [answer] = await db
    .insert(answers)
    .values({ questionId: question.id, content: "", status: "streaming" })
    .returning();
  if (!answer) return c.json({ error: "failed to record answer" }, 500);

  c.header("cache-control", "no-cache");
  c.header("x-accel-buffering", "no");
  return streamSSE(c, async (stream) => {
    let buffer = "";
    let cleanedText = "";
    let drafts: CitationDraft[] = [];
    try {
      for await (const frame of streamAnswer({
        db,
        sessionId,
        courseId: session.courseId,
        question: parsed.data.question,
        uptoSeconds: parsed.data.uptoSeconds,
      })) {
        if ("delta" in frame) {
          buffer += frame.delta;
          await stream.writeSSE({
            data: JSON.stringify({ delta: frame.delta }),
          });
        } else {
          cleanedText = frame.done.cleanedText;
          drafts = frame.done.citations;
        }
      }
    } catch (err) {
      // Persist partial buffer for debugging; mark failed.
      await db
        .update(answers)
        .set({ status: "failed", content: buffer })
        .where(eq(answers.id, answer.id));
      await stream.writeSSE({
        event: "error",
        data: JSON.stringify({
          error: err instanceof Error ? err.message : "model stream failed",
        }),
      });
      return;
    }

    // Commit final answer + citations atomically.
    await db.transaction(async (tx) => {
      await tx
        .update(answers)
        .set({
          content: cleanedText,
          status: "complete",
          completedAt: new Date(),
        })
        .where(eq(answers.id, answer.id));
      if (drafts.length > 0) {
        await tx.insert(citations).values(
          drafts.map((d) => ({
            answerId: answer.id,
            transcriptItemId: d.kind === "transcript" ? d.id : null,
            courseMaterialChunkId: d.kind === "material" ? d.id : null,
            snippet: d.snippet,
          })),
        );
      }
    });

    await stream.writeSSE({
      event: "citations",
      data: JSON.stringify(
        drafts.map((d, i) => ({
          index: i + 1,
          kind: d.kind,
          id: d.id,
          snippet: d.snippet,
        })),
      ),
    });
    await stream.writeSSE({
      event: "done",
      data: JSON.stringify({
        questionId: question.id,
        answerId: answer.id,
      }),
    });
  });
});
