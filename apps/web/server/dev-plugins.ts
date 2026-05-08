import type { Plugin } from "vite";

let apiApp: any = null;
let upgradeHandler: any = null;

async function getApiApp() {
  if (apiApp) return apiApp;

  const { readFile } = await import("node:fs/promises");
  const { resolve } = await import("node:path");
  const { Hono } = await import("hono");
  const { streamSSE } = await import("hono/streaming");
  const aiService = await import("@spr26/ai-service");
  const { default: auth } = await import("./auth.ts");
  const { default: instructorApi } = await import("./instructor-api.ts");
  const { default: slugApi } = await import("./slug-api.ts");
  const { default: liveTranscript } = await import("./live-transcript.ts");

  const TRANSCRIPT_PATH = resolve(
    import.meta.dirname,
    "..",
    "src",
    "data",
    "transcript.json",
  );

  const app = new Hono();
  app.route("/api/auth", auth);
  app.route("/api/instructor", instructorApi);
  app.route("/api/teach", slugApi);
  app.route("/api/live-transcript", liveTranscript);

  app.all("/api/qa", async (c: any) => {
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
    const transcript = JSON.parse(raw) as any[];
    const parsed = aiService.parseQaInput({
      t: url.searchParams.get("t"),
      question,
      transcript,
    });
    if (!parsed.ok) return c.json({ error: parsed.error }, parsed.status);

    c.header("cache-control", "no-cache");
    c.header("x-accel-buffering", "no");
    return streamSSE(c, async (stream: any) => {
      try {
        for await (const delta of aiService.streamAnswer(parsed)) {
          await stream.writeSSE({ data: JSON.stringify({ delta }) });
        }
        await stream.writeSSE({ event: "done", data: '"[DONE]"' });
      } catch (err: any) {
        await stream.writeSSE({
          event: "error",
          data: JSON.stringify({
            error: err instanceof Error ? err.message : "internal error",
          }),
        });
      }
    });
  });

  apiApp = app;
  return app;
}

async function getUpgradeHandler() {
  if (upgradeHandler) return upgradeHandler;
  const mod = await import("./audio-ws.ts");
  upgradeHandler = mod.handleUpgrade;
  return upgradeHandler;
}

export function devApiPlugin(): Plugin {
  return {
    name: "dev-api",
    configureServer(server) {
      server.middlewares.use("/api", async (req, res, next) => {
        const app = await getApiApp();
        const url = "http://localhost" + (req.url ?? "/");
        const headers = new Headers();
        for (const [key, value] of Object.entries(req.headers)) {
          if (value)
            headers.set(key, Array.isArray(value) ? value[0] : value);
        }

        let body: BodyInit | undefined;
        if (req.method !== "GET" && req.method !== "HEAD") {
          const chunks: Buffer[] = [];
          for await (const chunk of req) chunks.push(chunk as Buffer);
          body = Buffer.concat(chunks);
        }

        const request = new Request(url, {
          method: req.method,
          headers,
          body,
        });

        try {
          const response = await app.fetch(request);
          res.statusCode = response.status;
          response.headers.forEach((value: string, key: string) => {
            res.setHeader(key, value);
          });

          if (response.body) {
            const reader = response.body.getReader();
            const pump = async () => {
              while (true) {
                const { done, value } = await reader.read();
                if (done) {
                  res.end();
                  return;
                }
                res.write(value);
              }
            };
            await pump();
          } else {
            res.end(await response.text());
          }
        } catch (err) {
          next(err);
        }
      });

      server.httpServer?.on("upgrade", async (req, socket, head) => {
        if (req.url?.startsWith("/api/audio/")) {
          const handler = await getUpgradeHandler();
          handler(req, socket, head);
        }
      });
    },
  };
}
