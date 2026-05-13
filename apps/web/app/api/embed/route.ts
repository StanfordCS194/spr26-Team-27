import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Computes an embedding for one or more transcript_items rows and writes it
// back. Caller passes either a specific id or omits both to backfill any rows
// with NULL embedding. Stubbed for now — wire `embedMany` from `ai`.
export async function POST(req: Request) {
  let payload: { transcriptItemId?: string } = {};
  try {
    payload = (await req.json()) as { transcriptItemId?: string };
  } catch {
    /* allow empty body */
  }

  const supabase = createAdminClient();
  const query = supabase
    .from("transcript_items")
    .select("id, content")
    .is("embedding", null);

  const { data, error } = payload.transcriptItemId
    ? await query.eq("id", payload.transcriptItemId)
    : await query.limit(50);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!data || data.length === 0) return Response.json({ embedded: 0 });

  // TODO(amrit): replace stub with:
  //   import { embedMany } from "ai";
  //   import { openai } from "@ai-sdk/openai";
  //   const { embeddings } = await embedMany({
  //     model: openai.embedding("text-embedding-3-small"),
  //     values: data.map((r) => r.content),
  //   });
  const embeddings = data.map(() => Array.from({ length: 1536 }, () => 0));

  for (let i = 0; i < data.length; i++) {
    const vec = `[${embeddings[i].join(",")}]`;
    await supabase
      .from("transcript_items")
      .update({ embedding: vec })
      .eq("id", data[i].id);
  }

  return Response.json({ embedded: data.length });
}
