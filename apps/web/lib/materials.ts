import "server-only";

import { openai } from "@ai-sdk/openai";
import { embedMany, generateText } from "ai";

// Course-material ingestion pipeline: parse an uploaded file with LlamaParse,
// split the per-page markdown into chunks, contextualize each chunk
// (Anthropic's Contextual Retrieval), then embed. The upload route
// (app/api/materials/route.ts) is the only caller — kept inline here rather
// than split across files until a second caller exists.

const LLAMA_BASE = "https://api.cloud.llamaindex.ai/api/v1/parsing";
const EMBED_MODEL = "text-embedding-3-small"; // 1536-dim, matches vector(1536)
const CONTEXT_MODEL = "gpt-5.4-nano"; // cheapest GPT-5-gen; same OPENAI_API_KEY as embeddings

// ~600 tokens per chunk ≈ 2400 chars. Big enough for self-contained context,
// small enough that retrieval stays precise.
const MAX_CHUNK_CHARS = 2400;
// Cap the document we feed the contextualizer so a giant PDF doesn't blow the
// per-call cost / context window. 60k chars ≈ 15k tokens — plenty to situate a
// chunk, and it's prompt-cached so we pay for it roughly once per upload.
const CONTEXT_DOC_CHAR_CAP = 60_000;

export interface ParsedPage {
  page: number;
  md: string;
}

export interface MaterialChunk {
  index: number;
  content: string;
  heading: string | null;
  pageNumber: number | null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// LlamaParse v1 REST flow: upload (which also starts the job) → poll status →
// fetch the per-page JSON result. Per-page output is what lets us attribute a
// page number to every chunk for citations.
export async function parseFile(
  file: File,
): Promise<{ pages: ParsedPage[]; pageCount: number }> {
  const apiKey = process.env.LLAMA_CLOUD_API_KEY;
  if (!apiKey) throw new Error("LLAMA_CLOUD_API_KEY is not set");
  const auth = { Authorization: `Bearer ${apiKey}` };

  const form = new FormData();
  form.append("file", file, file.name || "upload");

  const upRes = await fetch(`${LLAMA_BASE}/upload`, {
    method: "POST",
    headers: auth,
    body: form,
  });
  if (!upRes.ok) {
    const detail = await upRes.text().catch(() => "");
    throw new Error(`LlamaParse upload failed (${upRes.status}): ${detail}`);
  }
  const { id } = (await upRes.json()) as { id?: string };
  if (!id) throw new Error("LlamaParse upload returned no job id");

  // Poll until the job finishes. LlamaParse reports SUCCESS / PENDING /
  // ERROR-ish terminal states; bail on timeout so we never hang the route.
  const deadline = Date.now() + 4 * 60_000;
  for (;;) {
    await sleep(2000);
    const stRes = await fetch(`${LLAMA_BASE}/job/${id}`, { headers: auth });
    if (!stRes.ok)
      throw new Error(`LlamaParse status check failed (${stRes.status})`);
    const { status } = (await stRes.json()) as { status?: string };
    if (status === "SUCCESS") break;
    if (
      status &&
      ["ERROR", "FAILED", "CANCELLED", "CANCELED"].includes(status)
    ) {
      throw new Error(`LlamaParse job ${status}`);
    }
    if (Date.now() > deadline) throw new Error("LlamaParse job timed out");
  }

  const resRes = await fetch(`${LLAMA_BASE}/job/${id}/result/json`, {
    headers: auth,
  });
  if (!resRes.ok)
    throw new Error(`LlamaParse result fetch failed (${resRes.status})`);
  const data = (await resRes.json()) as {
    pages?: { page?: number; md?: string; text?: string }[];
  };

  const pages: ParsedPage[] = (data.pages ?? [])
    .map((p, i) => ({
      page: typeof p.page === "number" ? p.page : i + 1,
      md: (p.md ?? p.text ?? "").trim(),
    }))
    .filter((p) => p.md.length > 0);

  if (pages.length === 0) {
    throw new Error("LlamaParse returned no extractable content");
  }
  return { pages, pageCount: pages.length };
}

// Greedily pack paragraph blocks into ~MAX_CHUNK_CHARS chunks, carrying the
// most recent markdown heading and the page a chunk starts on. Chunks may span
// a page boundary (common for slide decks with little text per page); the
// pageNumber is the first page contributing to the chunk.
export function chunkPages(pages: ParsedPage[]): MaterialChunk[] {
  const chunks: MaterialChunk[] = [];
  let buf = "";
  let bufPage: number | null = null;
  let heading: string | null = null;

  const push = (content: string, page: number | null) => {
    const trimmed = content.trim();
    if (trimmed.length === 0) return;
    chunks.push({
      index: chunks.length,
      content: trimmed,
      heading,
      pageNumber: page,
    });
  };

  const flush = () => {
    push(buf, bufPage);
    buf = "";
    bufPage = null;
  };

  for (const page of pages) {
    const blocks = page.md
      .split(/\n{2,}/)
      .map((b) => b.trim())
      .filter(Boolean);

    for (const block of blocks) {
      const headingMatch = /^#{1,6}\s+(.+)$/m.exec(block);
      if (headingMatch) heading = headingMatch[1].trim();

      // A single oversized block: hard-split it on its own.
      if (block.length > MAX_CHUNK_CHARS) {
        flush();
        for (let i = 0; i < block.length; i += MAX_CHUNK_CHARS) {
          push(block.slice(i, i + MAX_CHUNK_CHARS), page.page);
        }
        continue;
      }

      if (buf.length > 0 && buf.length + block.length + 2 > MAX_CHUNK_CHARS) {
        flush();
      }
      bufPage ??= page.page;
      buf += (buf.length ? "\n\n" : "") + block;
    }
  }
  flush();
  return chunks;
}

const CONTEXT_PROMPT_TAIL = `Here is the chunk we want to situate within the whole document:
<chunk>
{{CHUNK}}
</chunk>
Please give a short succinct context to situate this chunk within the overall document for the purposes of improving search retrieval of the chunk. Answer only with the succinct context and nothing else.`;

// Anthropic's Contextual Retrieval technique, run on OpenAI: for each chunk,
// ask a cheap model to write a one-line context that situates it in the whole
// document, then prepend that before embedding. The <document> block is the
// identical leading prefix on every call, so OpenAI's automatic prompt caching
// serves it cheaply after the first chunk (no annotation needed — caching keys
// off the longest common prefix for prompts ≥1024 tokens). Runs sequentially
// to keep that cache warm. Degrades to nulls (plain chunk) when no key.
export async function contextualizeChunks(
  fullText: string,
  chunks: MaterialChunk[],
): Promise<(string | null)[]> {
  if (!process.env.OPENAI_API_KEY) return chunks.map(() => null);

  const doc =
    fullText.length > CONTEXT_DOC_CHAR_CAP
      ? fullText.slice(0, CONTEXT_DOC_CHAR_CAP)
      : fullText;

  const out: (string | null)[] = [];
  for (const chunk of chunks) {
    try {
      const { text } = await generateText({
        model: openai(CONTEXT_MODEL),
        temperature: 0,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: `<document>\n${doc}\n</document>` },
              {
                type: "text",
                text: CONTEXT_PROMPT_TAIL.replace("{{CHUNK}}", chunk.content),
              },
            ],
          },
        ],
      });
      out.push(text.trim() || null);
    } catch {
      // A single contextualization failure shouldn't sink the whole upload —
      // fall back to embedding the bare chunk.
      out.push(null);
    }
  }
  return out;
}

// Embed `context + content` strings with the same model/dim as transcripts.
// Batched so a large deck doesn't exceed the embedding request limits.
export async function embedChunks(values: string[]): Promise<number[][]> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required to embed course materials");
  }
  const out: number[][] = [];
  for (let i = 0; i < values.length; i += 100) {
    const { embeddings } = await embedMany({
      model: openai.embedding(EMBED_MODEL),
      values: values.slice(i, i + 100),
    });
    out.push(...embeddings);
  }
  return out;
}

// The text we embed for a chunk: its context blurb (if any) prepended to the
// content, matching what the generated `fts` tsvector indexes.
export function embedText(
  chunk: MaterialChunk,
  context: string | null,
): string {
  return context ? `${context}\n\n${chunk.content}` : chunk.content;
}

export function fullDocumentText(pages: ParsedPage[]): string {
  return pages.map((p) => p.md).join("\n\n");
}
