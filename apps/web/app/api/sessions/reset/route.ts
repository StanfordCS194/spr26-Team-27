import { db } from "@/lib/db";
import { transcriptItems } from "@spr26/db";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Clears all transcript_items for a session — used by the instructor "Reset"
// button to wipe demo state and start over.
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

  const deleted = await db()
    .delete(transcriptItems)
    .where(eq(transcriptItems.sessionId, sessionId))
    .returning({ id: transcriptItems.id });

  return Response.json({ deleted: deleted.length });
}
