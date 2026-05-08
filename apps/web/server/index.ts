import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { app } from "./app.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = resolve(HERE, "..");
const DIST_DIR = resolve(APP_ROOT, "dist");
const INDEX_HTML = resolve(DIST_DIR, "index.html");

// serveStatic resolves `root` relative to cwd; pin it so the script works
// regardless of where it was launched from.
process.chdir(APP_ROOT);

app.use("/*", serveStatic({ root: "./dist" }));

// SPA fallback for client-side routes.
app.get("/*", async (c) => {
  const html = await readFile(INDEX_HTML, "utf8");
  return c.html(html);
});

const port = Number(process.env.PORT ?? 3000);
serve({ fetch: app.fetch, port }, ({ port }) => {
  console.log(`server listening on http://localhost:${port}`);
});
