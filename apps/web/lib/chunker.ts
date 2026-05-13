import "server-only";

import { db } from "@/lib/db";
import { transcriptChunks, transcriptItems } from "@spr26/db";
import { openai } from "@ai-sdk/openai";
import { embedMany } from "ai";
import { and, asc, eq, gte, isNotNull, lte, sql } from "drizzle-orm";

// Sliding-window config. Each chunk covers WINDOW utterances (~3min at our
// 10s cadence) and the next chunk overlaps by OVERLAP to keep semantic
// continuity across boundaries.
export const WINDOW = 20;
export const OVERLAP = 5;
const STRIDE = WINDOW - OVERLAP; // 15

const EMBED_MODEL = "text-embedding-3-small";

async function maxExistingChunkEnd(sessionId: string): Promise<number | null> {
  const [row] = await db()
    .select({
      max: sql<number | null>`MAX(${transcriptChunks.endSeq})::int`,
    })
    .from(transcriptChunks)
    .where(eq(transcriptChunks.sessionId, sessionId));
  return row?.max ?? null;
}

async function maxTranscriptSeq(sessionId: string): Promise<number | null> {
  const [row] = await db()
    .select({
      max: sql<number | null>`MAX(${transcriptItems.sequence})::int`,
    })
    .from(transcriptItems)
    .where(eq(transcriptItems.sessionId, sessionId));
  return row?.max ?? null;
}

// Build every pending chunk for `sessionId` in order, embed them in one
// batch, write back. Idempotent — if there's not enough new transcript to
// justify the next chunk yet, it's a no-op.
export async function buildPendingChunks(sessionId: string): Promise<{
  built: number;
}> {
  const maxItemSeq = await maxTranscriptSeq(sessionId);
  if (maxItemSeq === null) return { built: 0 };

  const lastEnd = await maxExistingChunkEnd(sessionId); // -1 conceptually

  const pendingRanges: { start: number; end: number }[] = [];
  let nextStart =
    lastEnd === null ? 0 : Math.max(0, lastEnd - OVERLAP + 1) + STRIDE - (STRIDE);
  // Cleaner: derive starts directly.
  if (lastEnd === null) {
    nextStart = 0;
  } else {
    nextStart = Math.max(0, lastEnd + 1 - OVERLAP);
  }

  while (nextStart + WINDOW - 1 <= maxItemSeq) {
    const end = nextStart + WINDOW - 1;
    pendingRanges.push({ start: nextStart, end });
    nextStart += STRIDE;
  }

  if (pendingRanges.length === 0) return { built: 0 };

  // Fetch all items in one query covering all pending ranges.
  const minStart = pendingRanges[0].start;
  const maxEnd = pendingRanges[pendingRanges.length - 1].end;
  const rows = await db()
    .select({
      sequence: transcriptItems.sequence,
      timestampSeconds: transcriptItems.timestampSeconds,
      content: transcriptItems.content,
    })
    .from(transcriptItems)
    .where(
      and(
        eq(transcriptItems.sessionId, sessionId),
        gte(transcriptItems.sequence, minStart),
        lte(transcriptItems.sequence, maxEnd),
      ),
    )
    .orderBy(asc(transcriptItems.sequence));

  const bySeq = new Map(rows.map((r) => [r.sequence, r]));

  type Pending = {
    start: number;
    end: number;
    startTs: number;
    endTs: number;
    content: string;
  };
  const pending: Pending[] = [];

  for (const range of pendingRanges) {
    const items: typeof rows = [];
    for (let s = range.start; s <= range.end; s++) {
      const row = bySeq.get(s);
      if (row) items.push(row);
    }
    if (items.length === 0) continue;
    pending.push({
      start: range.start,
      end: range.end,
      startTs: items[0].timestampSeconds,
      endTs: items[items.length - 1].timestampSeconds,
      content: items.map((it) => it.content).join(" "),
    });
  }

  if (pending.length === 0) return { built: 0 };

  if (!process.env.OPENAI_API_KEY) {
    throw new Error(
      "OPENAI_API_KEY is required to embed transcript chunks. Set it in apps/web/.env.local (and on Vercel) before chunking.",
    );
  }
  const { embeddings } = await embedMany({
    model: openai.embedding(EMBED_MODEL),
    values: pending.map((p) => p.content),
  });

  for (let i = 0; i < pending.length; i++) {
    const p = pending[i];
    try {
      await db()
        .insert(transcriptChunks)
        .values({
          sessionId,
          startSeq: p.start,
          endSeq: p.end,
          startTimestampSeconds: p.startTs,
          endTimestampSeconds: p.endTs,
          content: p.content,
          embedding: embeddings[i],
        });
    } catch (err) {
      // Likely unique-violation from a concurrent chunk run — safe to ignore.
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes("transcript_chunks_session_start_unique")) throw err;
    }
  }

  return { built: pending.length };
}

// Backfills embeddings for any chunks that were inserted without one
// (typically when OPENAI_API_KEY wasn't set at insert time). Used by cron.
export async function backfillChunkEmbeddings(): Promise<{ embedded: number }> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error(
      "OPENAI_API_KEY is required to embed transcript chunks. Set it in apps/web/.env.local (and on Vercel) before chunking.",
    );
  }
  const rows = await db()
    .select({
      id: transcriptChunks.id,
      content: transcriptChunks.content,
    })
    .from(transcriptChunks)
    .where(sql`${transcriptChunks.embedding} IS NULL`)
    .limit(50);

  if (rows.length === 0) return { embedded: 0 };

  const { embeddings } = await embedMany({
    model: openai.embedding(EMBED_MODEL),
    values: rows.map((r) => r.content),
  });

  for (let i = 0; i < rows.length; i++) {
    await db()
      .update(transcriptChunks)
      .set({ embedding: embeddings[i] })
      .where(eq(transcriptChunks.id, rows[i].id));
  }

  return { embedded: rows.length };
}

// Cosine search over transcript_chunks for a given session.
export async function searchChunks({
  sessionId,
  queryEmbedding,
  k = 4,
}: {
  sessionId: string;
  queryEmbedding: number[];
  k?: number;
}) {
  const vec = `[${queryEmbedding.join(",")}]`;
  return await db()
    .select({
      id: transcriptChunks.id,
      startSeq: transcriptChunks.startSeq,
      endSeq: transcriptChunks.endSeq,
      startTimestampSeconds: transcriptChunks.startTimestampSeconds,
      endTimestampSeconds: transcriptChunks.endTimestampSeconds,
      content: transcriptChunks.content,
    })
    .from(transcriptChunks)
    .where(
      and(
        eq(transcriptChunks.sessionId, sessionId),
        isNotNull(transcriptChunks.embedding),
      ),
    )
    .orderBy(sql`${transcriptChunks.embedding} <=> ${vec}::vector`)
    .limit(k);
}
