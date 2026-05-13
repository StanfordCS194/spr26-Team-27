import { backfillChunkEmbeddings, buildPendingChunks } from "@/lib/chunker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Called directly with a session id to build chunks for that session, OR
// hit with no body by the Vercel cron as a backfill safety net.
export async function POST(req: Request) {
  let body: { sessionId?: string } = {};
  try {
    body = (await req.json()) as { sessionId?: string };
  } catch {
    /* empty body OK */
  }

  try {
    if (!body.sessionId) {
      const embedded = await backfillChunkEmbeddings();
      return Response.json({ ...embedded });
    }
    const built = await buildPendingChunks(body.sessionId);
    return Response.json(built);
  } catch (err) {
    const message = err instanceof Error ? err.message : "chunk failed";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const embedded = await backfillChunkEmbeddings();
    return Response.json(embedded);
  } catch (err) {
    const message = err instanceof Error ? err.message : "chunk failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
