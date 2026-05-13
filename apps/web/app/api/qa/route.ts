import { parseQaInput, streamAnswer } from "@spr26/ai-service";
import transcriptJson from "@/data/transcript.json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TranscriptRow = { timestamp: string; content: string };
const transcript = transcriptJson as TranscriptRow[];

async function handle(req: Request) {
  const url = new URL(req.url);
  let question: string | null;
  if (req.method === "GET") {
    question = url.searchParams.get("q");
  } else {
    try {
      const body = (await req.json()) as { question?: string };
      question = body.question ?? null;
    } catch {
      return Response.json({ error: "invalid JSON body" }, { status: 400 });
    }
  }

  const parsed = parseQaInput({
    t: url.searchParams.get("t"),
    f: url.searchParams.get("f"),
    question,
    transcript,
  });
  if (!parsed.ok) {
    return Response.json({ error: parsed.error }, { status: parsed.status });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const delta of streamAnswer(parsed)) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ delta })}\n\n`),
          );
        }
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
