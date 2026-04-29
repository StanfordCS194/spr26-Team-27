import { iterSse, safeJson } from "@/lib/sse";

// Client for the /api/qa SSE endpoint.
//
// Why POST (not GET): questions can get long and URL length limits would bite.
// Why `t` still as a query param: keeps the server-side prompt-cache key short
// and matches the existing endpoint contract (see apps/web/server/app.ts).
//
// The endpoint streams Server-Sent Events:
//   data: {"delta":"..."}    -> incremental text
//   event: done              -> stream finished cleanly
//   event: error             -> server-side failure
// We translate that here so the rest of the app only sees an async iterable
// of string deltas.

export interface StreamQaArgs {
  question: string;
  uptoSeconds: number;
  signal?: AbortSignal;
}

export async function* streamQa({
  question,
  uptoSeconds,
  signal,
}: StreamQaArgs): AsyncGenerator<string, void, void> {
  const res = await fetch(`/api/qa?t=${encodeURIComponent(uptoSeconds)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ question }),
    signal,
  });

  for await (const evt of iterSse(res)) {
    if (evt.event === "done") return;
    if (evt.event === "error") {
      const parsed = safeJson(evt.data) as { error?: string } | null;
      throw new Error(parsed?.error ?? "qa stream errored");
    }
    const parsed = safeJson(evt.data) as { delta?: string } | null;
    if (parsed?.delta) yield parsed.delta;
  }
}
