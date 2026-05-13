import { db } from "@/lib/db";
import { transcriptItems } from "@spr26/db";
import { eq, sql } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GROQ_TRANSCRIBE_URL =
  "https://api.groq.com/openai/v1/audio/transcriptions";
// whisper-large-v3-turbo: ~3x faster than v3 with similar accuracy on short
// clips. Both are on Groq's free tier.
const GROQ_MODEL = "whisper-large-v3-turbo";
const CHUNK_SECONDS = 10;

interface GroqResponse {
  text: string;
}

async function transcribeWithGroq(audio: Blob): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY is not set");

  const fd = new FormData();
  fd.append("file", audio, "chunk.webm");
  fd.append("model", GROQ_MODEL);
  fd.append("response_format", "json");
  fd.append("temperature", "0");
  fd.append("language", "en");

  // Two retries with light backoff for transient 429/5xx from Groq.
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 250 * attempt));
    const res = await fetch(GROQ_TRANSCRIBE_URL, {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}` },
      body: fd,
    });
    if (res.ok) {
      const data = (await res.json()) as GroqResponse;
      return data.text.trim();
    }
    if (res.status !== 429 && res.status < 500) {
      const text = await res.text().catch(() => "");
      throw new Error(`Groq transcribe ${res.status}: ${text}`);
    }
    lastErr = new Error(`Groq transcribe ${res.status}`);
  }
  throw lastErr ?? new Error("Groq transcribe failed");
}

// Whisper boilerplate on silence/noise — drop so transcripts don't fill with
// "you" / "Thanks for watching."
const NOISE_PATTERNS = [
  /^you$/i,
  /^thank you\.?$/i,
  /^thanks for watching\.?$/i,
  /^\.+$/,
];

function isNoise(text: string): boolean {
  return text.length === 0 || NOISE_PATTERNS.some((p) => p.test(text));
}

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
  if (!(audio instanceof Blob)) {
    return Response.json({ error: "audio file required" }, { status: 400 });
  }
  // Tiny payloads are usually flushes from MediaRecorder.stop() that contain
  // no audible content; Whisper rejects them with 400.
  if (audio.size < 2_000) {
    return Response.json({ skipped: true, reason: "too_small" });
  }

  let text: string;
  try {
    text = await transcribeWithGroq(audio);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "transcription failed" },
      { status: 502 },
    );
  }

  if (isNoise(text)) {
    return Response.json({ skipped: true, reason: "silence_or_noise" });
  }

  // Pick the next sequence server-side so a restarted recording (client
  // seqRef resets to 0) doesn't collide with rows already in the session.
  const [{ next }] = await db()
    .select({ next: sql<number>`COALESCE(MAX(${transcriptItems.sequence}) + 1, 0)::int` })
    .from(transcriptItems)
    .where(eq(transcriptItems.sessionId, sessionId));

  const timestampSeconds = next * CHUNK_SECONDS;

  const [row] = await db()
    .insert(transcriptItems)
    .values({ sessionId, sequence: next, timestampSeconds, content: text })
    .returning({ id: transcriptItems.id });

  return Response.json({ id: row.id, text });
}
