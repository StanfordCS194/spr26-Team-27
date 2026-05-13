import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Receives a single ~8s audio chunk from the instructor's RecordButton, runs
// speech-to-text, and inserts a transcript_items row. Supabase Realtime
// publication on transcript_items pushes the new row to subscribed students.
//
// Whisper integration is stubbed — wire OPENAI_API_KEY then drop in the call.
// Keeping the row-insert path live now so realtime can be exercised against
// dummy transcripts in dev.
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

  // Approximate timestamp using sequence × chunk duration (8s) for now; once
  // the recorder reports a real wall-clock offset we'll thread it through.
  const timestampSeconds = sequence * 8;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("transcript_items")
    .insert({
      session_id: sessionId,
      sequence,
      timestamp_seconds: timestampSeconds,
      content: text,
    })
    .select("id")
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  // Fire-and-forget the embedding job. Don't block transcript broadcast on it.
  void fetch(new URL("/api/embed", req.url), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ transcriptItemId: data.id }),
  }).catch(() => {});

  return Response.json({ id: data.id });
}
