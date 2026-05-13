import { db } from "@/lib/db";
import { transcriptItems } from "@spr26/db";
import { eq } from "drizzle-orm";
import seededTranscript from "@/data/transcript.json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function parseTs(ts: string): number {
  const parts = ts.split(":").map((p) => Number.parseInt(p, 10));
  if (parts.some(Number.isNaN)) return 0;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return 0;
}

// Bypasses Whisper for demos: takes the bundled lecture transcript JSON and
// loads it into transcript_items for the given session, then embeds everything
// in one shot so RAG works immediately.
export async function POST(req: Request) {
  let body: { sessionId?: string };
  try {
    body = (await req.json()) as { sessionId?: string };
  } catch {
    return Response.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const sessionId = body.sessionId;
  if (!sessionId) {
    return Response.json({ error: "sessionId is required" }, { status: 400 });
  }

  const items = seededTranscript as Array<{
    timestamp: string;
    content: string;
  }>;

  const rows = items
    .filter((it) => it.content.trim().length > 0)
    .map((it, index) => ({
      sessionId,
      sequence: index,
      timestampSeconds: parseTs(it.timestamp),
      content: it.content.trim(),
    }));

  if (rows.length === 0) return Response.json({ inserted: 0 });

  // Wipe any existing rows for this session so the sample is the only source.
  await db()
    .delete(transcriptItems)
    .where(eq(transcriptItems.sessionId, sessionId));

  const inserted = await db()
    .insert(transcriptItems)
    .values(rows)
    .returning({ id: transcriptItems.id });

  return Response.json({ inserted: inserted.length });
}
