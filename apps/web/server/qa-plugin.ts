import { readFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { resolve } from "node:path";
import {
  parseQaInput,
  streamAnswer,
  type TranscriptItem,
} from "@spr26/ai-service";
import type { Plugin } from "vite";

const TRANSCRIPT_PATH = resolve(
  import.meta.dirname,
  "..",
  "src",
  "data",
  "transcript.json",
);

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  return JSON.parse(raw);
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(body));
}

function writeSseEvent(
  res: ServerResponse,
  data: unknown,
  event?: string,
): void {
  if (event) res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

async function handle(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? "/", "http://localhost");

  let question: string | null;
  if (req.method === "GET") {
    question = url.searchParams.get("q");
  } else if (req.method === "POST") {
    try {
      const body = (await readJsonBody(req)) as { question?: string };
      question = body.question ?? null;
    } catch {
      sendJson(res, 400, { error: "invalid JSON body" });
      return;
    }
  } else {
    sendJson(res, 405, { error: "method not allowed" });
    return;
  }

  const raw = await readFile(TRANSCRIPT_PATH, "utf8");
  const transcript = JSON.parse(raw) as TranscriptItem[];

  const parsed = parseQaInput({
    t: url.searchParams.get("t"),
    f: url.searchParams.get("f"),
    question,
    transcript,
  });
  if (!parsed.ok) {
    sendJson(res, parsed.status, { error: parsed.error });
    return;
  }

  res.statusCode = 200;
  res.setHeader("content-type", "text/event-stream");
  res.setHeader("cache-control", "no-cache");
  res.setHeader("connection", "keep-alive");
  // Disable proxy buffering (nginx etc).
  res.setHeader("x-accel-buffering", "no");
  res.flushHeaders?.();

  // Bail out cleanly if the client disconnects mid-stream so we stop
  // generating tokens into a closed socket.
  const ac = new AbortController();
  req.on("close", () => ac.abort());

  try {
    for await (const delta of streamAnswer({
      ...parsed,
      abortSignal: ac.signal,
    })) {
      writeSseEvent(res, { delta });
    }
    writeSseEvent(res, "[DONE]", "done");
  } catch (err) {
    if (ac.signal.aborted) return;
    writeSseEvent(
      res,
      { error: err instanceof Error ? err.message : "internal error" },
      "error",
    );
  } finally {
    res.end();
  }
}

export function qaApiPlugin(): Plugin {
  return {
    name: "qa-api",
    configureServer(server) {
      server.middlewares.use("/api/qa", (req, res, next) => {
        handle(req, res).catch(next);
      });
    },
  };
}
