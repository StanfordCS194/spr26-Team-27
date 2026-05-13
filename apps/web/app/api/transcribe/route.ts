import { db } from "@/lib/db";
import { transcriptItems } from "@spr26/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Receives a single ~8s audio chunk from the instructor's RecordButton, runs
// speech-to-text, and inserts a transcript_items row. Supabase Realtime
// publication on transcript_items pushes the row to subscribed clients.
//
// Whisper integration is stubbed — wire OPENAI_API_KEY then drop in the call.
export async function POST(req: Request) {
  const form = await req.formData();
  const sessionId = form.get("sessionId");
  const sequenceRaw = form.get("sequence");
  const audio = form.get("audio");

  if (typeof sessionId !== "string" || typeof sequenceRaw !== "string") {
    return Response.json(
      { error: "sessionId and sequence are required" },
      { status: 400 },
    );
  }
  const sequence = Number.parseInt(sequenceRaw, 10);
  if (!Number.isFinite(sequence)) {
    return Response.json(
      { error: "sequence must be an integer" },
      { status: 400 },
    );
  }
  if (!(audio instanceof Blob)) {
    return Response.json({ error: "audio file required" }, { status: 400 });
  }

  // TODO(amrit): swap stub for real Whisper call:
  //   const fd = new FormData();
  //   fd.append("file", audio, "chunk.webm");
  //   fd.append("model", "whisper-1");
  //   const r = await fetch("https://api.openai.com/v1/audio/transcriptions", {
  //     method: "POST",
  //     headers: { authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
  //     body: fd,
  //   });
  //   const { text } = await r.json();
  const text = `[stub transcript for chunk ${sequence} — wire Whisper to replace]`;

  // Approximate timestamp via sequence × chunk duration (8s); thread a real
  // wall-clock offset through later.
  const timestampSeconds = sequence * 8;

  const [row] = await db()
    .insert(transcriptItems)
    .values({
      sessionId,
      sequence,
      timestampSeconds,
      content: text,
    })
    .returning({ id: transcriptItems.id });

  // Fire-and-forget the embedding job. Don't block transcript broadcast.
  void fetch(new URL("/api/embed", req.url), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ transcriptItemId: row.id }),
  }).catch(() => {});

  return Response.json({ id: row.id });
}
