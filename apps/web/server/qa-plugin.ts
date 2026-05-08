import type { IncomingMessage, ServerResponse } from "node:http";
import { Readable } from "node:stream";
import type { Plugin } from "vite";
import { app } from "./app.ts";

// Vite middleware that delegates `/api/*` to the same Hono app prod uses, so
// route definitions live in one place and dev/prod parity is real.
async function handle(req: IncomingMessage, res: ServerResponse) {
  const host = req.headers.host ?? "localhost";
  const url = `http://${host}${req.url ?? "/"}`;

  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (v == null) continue;
    if (Array.isArray(v)) for (const item of v) headers.append(k, item);
    else headers.set(k, v);
  }

  const init: RequestInit & { duplex?: "half" } = {
    method: req.method,
    headers,
  };
  if (req.method && req.method !== "GET" && req.method !== "HEAD") {
    init.body = Readable.toWeb(req) as unknown as ReadableStream<Uint8Array>;
    init.duplex = "half"; // required when streaming a body
  }

  const response = await app.fetch(new Request(url, init));

  res.statusCode = response.status;
  response.headers.forEach((v, k) => res.setHeader(k, v));
  if (!response.body) {
    res.end();
    return;
  }
  res.flushHeaders?.();
  const reader = response.body.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    res.write(value);
  }
  res.end();
}

export function qaApiPlugin(): Plugin {
  return {
    name: "api",
    configureServer(server) {
      server.middlewares.use("/api", (req, res, next) => {
        handle(req, res).catch(next);
      });
    },
  };
}
