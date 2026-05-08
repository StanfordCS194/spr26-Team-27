import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import {
  parseQaInput,
  streamAnswer,
  type TranscriptItem,
} from "@spr26/ai-service";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import auth from "./auth.ts";
import instructorApi from "./instructor-api.ts";
import slugApi from "./slug-api.ts";
import liveTranscript from "./live-transcript.ts";
import { handleUpgrade } from "./audio-ws.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = resolve(HERE, "..");
const TRANSCRIPT_PATH = resolve(APP_ROOT, "src", "data", "transcript.json");
const DIST_DIR = resolve(APP_ROOT, "dist");
const INDEX_HTML = resolve(DIST_DIR, "index.html");

process.chdir(APP_ROOT);

const app = new Hono();

app.route("/api/auth", auth);
app.route("/api/instructor", instructorApi);
app.route("/api/teach", slugApi);
app.route("/api/live-transcript", liveTranscript);

app.all("/api/qa", async (c) => {
  const url = new URL(c.req.url);

  let question: string | null;
  if (c.req.method === "GET") {
    question = url.searchParams.get("q");
  } else if (c.req.method === "POST") {
    try {
      const body = await c.req.json<{ question?: string }>();
      question = body.question ?? null;
    } catch {
      return c.json({ error: "invalid JSON body" }, 400);
    }
  } else {
    return c.json({ error: "method not allowed" }, 405);
  }

  const raw = await readFile(TRANSCRIPT_PATH, "utf8");
  const transcript = JSON.parse(raw) as TranscriptItem[];

  const parsed = parseQaInput({
    t: url.searchParams.get("t"),
    question,
    transcript,
  });
  if (!parsed.ok) {
    return c.json({ error: parsed.error }, parsed.status);
  }

  c.header("cache-control", "no-cache");
  c.header("x-accel-buffering", "no");
  return streamSSE(c, async (stream) => {
    try {
      for await (const delta of streamAnswer(parsed)) {
        await stream.writeSSE({ data: JSON.stringify({ delta }) });
      }
      await stream.writeSSE({ event: "done", data: '"[DONE]"' });
    } catch (err) {
      await stream.writeSSE({
        event: "error",
        data: JSON.stringify({
          error: err instanceof Error ? err.message : "internal error",
        }),
      });
    }
  });
});

app.use("/*", serveStatic({ root: "./dist" }));

app.get("/*", async (c) => {
  const html = await readFile(INDEX_HTML, "utf8");
  return c.html(html);
});

const port = Number(process.env.PORT ?? 3000);

const server = serve({ fetch: app.fetch, port }, ({ port }) => {
  console.log(`server listening on http://localhost:${port}`);
});

server.on("upgrade", (req: any, socket: any, head: any) => {
  handleUpgrade(req, socket, head);
});
