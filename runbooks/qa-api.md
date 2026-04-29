# QA API

A streaming endpoint that answers questions about the lecture transcript using
an LLM. Retrieval is intentionally trivial: the handler filters the transcript
to the lines whose timestamp is **before** `t` (the current playback position)
and puts those lines straight in the prompt. No DB, no embeddings.

The endpoint streams tokens back over **Server-Sent Events**.

## Architecture

```
apps/web/                              packages/ai-service/
├── server/                            └── src/
│   ├── qa-plugin.ts  (vite dev mw)        ├── qa.ts       streamAnswer()
│   └── index.ts      (hono prod)          ├── handler.ts  parseQaInput()
└── src/data/transcript.json               └── index.ts
```

`@spr26/ai-service` is framework-agnostic:

- `streamAnswer({ transcript, uptoSeconds, question })` →
  `AsyncIterable<string>`. Each yielded string is a token delta from the model.
- `parseQaInput({ t, question, transcript })` → tagged union; validates the
  request and either returns `{ ok: true, ... }` ready for `streamAnswer`, or
  `{ ok: false, status: 400, error: "..." }` for the adapter to send back.
- `parseTimestamp("12:34")` / `parseTimestamp("1:02:03")` — `mm:ss` or
  `h:mm:ss` → seconds.

The Vite middleware (`server/qa-plugin.ts`) and the Hono server
(`server/index.ts`) are thin adapters: parse the HTTP request, load
`transcript.json` from disk, validate via `parseQaInput`, then iterate
`streamAnswer` and write SSE frames.

## Environment variables

The model is picked at request time based on which key is set:

| Var                 | Model used        |
| ------------------- | ----------------- |
| `ANTHROPIC_API_KEY` | `claude-opus-4-7` |
| `OPENAI_API_KEY`    | `gpt-5.5`         |

Anthropic wins if both are set. The stream emits an `error` event with a clear
message if neither is set.

`PORT` controls the production server's listen port (default `3000`).

## API contract

`GET /api/qa?t=<seconds>&q=<question>`
`POST /api/qa?t=<seconds>` with body `{ "question": "..." }`

`t` is required and must be a finite number (seconds). Lines whose timestamp is
strictly less than `t` are included in the prompt. POST is preferred for
non-trivial questions (no URL-length limit, easier to escape).

**Validation errors** (returned as plain JSON, not SSE):

- `400` → `{ "error": "missing t query param" | "t must be a number (seconds)" | "missing question" | "invalid JSON body" }`
- `405` → `{ "error": "method not allowed" }`

**Success** (`200`, `Content-Type: text/event-stream`):

```
data: {"delta":"The"}

data: {"delta":" professor"}

data: {"delta":" mentions..."}

event: done
data: "[DONE]"
```

**Streaming errors** (mid-stream model/auth failure):

```
event: error
data: {"error":"<message>"}
```

The connection then closes. Clients should reconnect or surface the error.

## Running it

### Dev

```bash
ANTHROPIC_API_KEY=… npm run dev      # from repo root, runs vite at :5173
curl -N 'http://localhost:5173/api/qa?t=300&q=who+is+teaching+today'
```

`-N` (no buffering) is important — `curl` otherwise waits for the connection to
close before printing anything. The Vite dev server mounts the QA middleware
before the SPA, so the same origin serves both.

### Production

```bash
npm run build -w @spr26/web                       # vite build → apps/web/dist/
ANTHROPIC_API_KEY=… npm run start -w @spr26/web   # hono on :3000
```

The Hono server serves `apps/web/dist/` as static, falls back to `index.html`
for SPA routes, and mounts the QA endpoint at `/api/qa`. Run it from anywhere —
it `chdir`s to its own directory at startup.

## Calling it from the React app

`EventSource` is the path-of-least-resistance for SSE, but it's GET-only and
won't carry a JSON body. For long questions use `fetch` + a manual SSE parser
on the response body:

```ts
export async function askStream(
  question: string,
  currentSeconds: number,
  onDelta: (chunk: string) => void,
): Promise<void> {
  const res = await fetch(`/api/qa?t=${currentSeconds}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ question }),
  });
  if (!res.ok) throw new Error((await res.json()).error);
  if (!res.body) throw new Error("no response body");

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) return;
    buffer += value;

    // SSE frames are separated by a blank line.
    let idx;
    while ((idx = buffer.indexOf("\n\n")) !== -1) {
      const frame = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);

      const lines = frame.split("\n");
      const event = lines.find((l) => l.startsWith("event: "))?.slice(7);
      const data = lines.find((l) => l.startsWith("data: "))?.slice(6);
      if (!data) continue;

      if (event === "done") return;
      if (event === "error") throw new Error(JSON.parse(data).error);
      const parsed = JSON.parse(data) as { delta?: string };
      if (parsed.delta) onDelta(parsed.delta);
    }
  }
}
```

`currentSeconds` is the video player's current time. Pass it raw — the API
expects seconds, the same unit `parseTimestamp` returns.

In a React component, accumulate deltas into local state and abort the request
on unmount with `AbortController`.

## Adding new endpoints

1. Put framework-agnostic logic in `packages/ai-service/src/<name>.ts` and
   export it from `index.ts`. Anything that touches `process.env`, the LLM,
   or pure data transforms goes here. For streaming endpoints, expose an
   `AsyncIterable<T>` rather than the raw ai-sdk result — keeps the surface
   small and avoids leaking complex generic types.
2. Add an adapter in **both** `apps/web/server/qa-plugin.ts` (dev mw) **and**
   `apps/web/server/index.ts` (Hono). Keep them ~30 lines each: parse request
   → call the shared logic → write the response.
3. If the new handler reads files at runtime, resolve paths from
   `import.meta.dirname` (dev plugin) or the `APP_ROOT` constant (Hono) — never
   from `process.cwd()`, since dev and prod run from different directories.

## Switching the data source

Right now both adapters `readFile(transcript.json)` on every request. Cheap
because the file is small (~30KB), but if you swap to a DB or remote fetch:

- Don't push that into `@spr26/ai-service` — keep it pure.
- Replace the `readFile` + `JSON.parse` in each adapter with the new loader.
- Cache at the adapter layer if you need to (a module-level `let cached` is
  fine for a single transcript; reach for an LRU once there are many).
