import { db } from "@/lib/db";
import { transcriptItems } from "@spr26/db";
import { eq, isNull } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Computes embeddings for transcript_items rows and writes them back.
// Caller passes a specific id, or omits to backfill up to 50 NULL rows.
// embedMany call is stubbed — wire `ai` + `@ai-sdk/openai` to enable.
export async function POST(req: Request) {
  let payload: { transcriptItemId?: string } = {};
  try {
    payload = (await req.json()) as { transcriptItemId?: string };
  } catch {
    /* allow empty body */
  }

  const where = payload.transcriptItemId
    ? eq(transcriptItems.id, payload.transcriptItemId)
    : isNull(transcriptItems.embedding);

  const rows = await db()
    .select({ id: transcriptItems.id, content: transcriptItems.content })
    .from(transcriptItems)
    .where(where)
    .limit(payload.transcriptItemId ? 1 : 50);

  if (rows.length === 0) return Response.json({ embedded: 0 });

  // TODO(amrit): replace stub with:
  //   import { embedMany } from "ai";
  //   import { openai } from "@ai-sdk/openai";
  //   const { embeddings } = await embedMany({
  //     model: openai.embedding("text-embedding-3-small"),
  //     values: rows.map((r) => r.content),
  //   });
  const embeddings: number[][] = rows.map(() =>
    Array.from({ length: 1536 }, () => 0),
  );

  for (let i = 0; i < rows.length; i++) {
    await db()
      .update(transcriptItems)
      .set({ embedding: embeddings[i] })
      .where(eq(transcriptItems.id, rows[i].id));
  }

  return Response.json({ embedded: rows.length });
}
