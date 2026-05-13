import { db } from "@/lib/db";
import { transcriptItems } from "@spr26/db";
import { openai } from "@ai-sdk/openai";
import { embedMany } from "ai";
import { eq, isNull } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 1536-dim, matches vector(1536). L2-normalised, so cosine ≈ dot product,
// which is what the HNSW vector_cosine_ops index expects.
const EMBED_MODEL = "text-embedding-3-small";

async function embedWithRetry(values: string[]): Promise<number[][]> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 300 * attempt));
    try {
      const { embeddings } = await embedMany({
        model: openai.embedding(EMBED_MODEL),
        values,
      });
      return embeddings;
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr ?? new Error("embedMany failed");
}

async function processBatch(transcriptItemId?: string) {
  const where = transcriptItemId
    ? eq(transcriptItems.id, transcriptItemId)
    : isNull(transcriptItems.embedding);

  const rows = await db()
    .select({ id: transcriptItems.id, content: transcriptItems.content })
    .from(transcriptItems)
    .where(where)
    .limit(transcriptItemId ? 1 : 50);

  if (rows.length === 0) return 0;

  const embeddings = await embedWithRetry(rows.map((r) => r.content));

  for (let i = 0; i < rows.length; i++) {
    await db()
      .update(transcriptItems)
      .set({ embedding: embeddings[i] })
      .where(eq(transcriptItems.id, rows[i].id));
  }

  return rows.length;
}

// Called directly by /api/transcribe with a specific id for low-latency
// embedding right after insert.
export async function POST(req: Request) {
  let payload: { transcriptItemId?: string } = {};
  try {
    payload = (await req.json()) as { transcriptItemId?: string };
  } catch {
    /* empty body OK */
  }
  const embedded = await processBatch(payload.transcriptItemId);
  return Response.json({ embedded });
}

// Called by Vercel Cron every minute. Backfills any row with NULL embedding
// (transcribe-side handoff drops, transient OpenAI failures, etc.).
export async function GET() {
  const embedded = await processBatch();
  return Response.json({ embedded });
}
