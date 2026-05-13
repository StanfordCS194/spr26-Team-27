import { iterSse, safeJson } from "@/lib/sse";

export interface StreamQaArgs {
  question: string;
  uptoSeconds: number;
  /** Optional lower-bound (seconds) — used by windowed quick prompts. */
  fromSeconds?: number;
  signal?: AbortSignal;
}

// POSTs the question (so it can be long) with `t`/`f` in the query string,
// reads SSE deltas, yields plain strings.
export async function* streamQa({
  question,
  uptoSeconds,
  fromSeconds,
  signal,
}: StreamQaArgs): AsyncGenerator<string, void, void> {
  const params = new URLSearchParams({ t: String(uptoSeconds) });
  if (fromSeconds !== undefined) params.set("f", String(fromSeconds));
  const res = await fetch(`/api/qa?${params.toString()}`, {
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
