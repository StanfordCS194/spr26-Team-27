import { iterSse, safeJson } from "@/lib/sse";

export interface MaterialCitation {
  n: number;
  materialId: string;
  materialTitle: string;
  chunkId: string;
  pageNumber: number | null;
  preview: string;
}

export interface CitationManifest {
  materials: MaterialCitation[];
}

export interface ToolEvent {
  id: string;
  name: string;
  args?: Record<string, unknown>;
  resultCount?: number;
}

export interface StreamQaArgs {
  question: string;
  sessionId: string;
  signal?: AbortSignal;
}

export type QaEvent =
  | { type: "delta"; delta: string }
  | { type: "tool_call"; tool: ToolEvent }
  | { type: "tool_result"; tool: ToolEvent }
  | { type: "citations"; citations: CitationManifest };

export async function* streamQa({
  question,
  sessionId,
  signal,
}: StreamQaArgs): AsyncGenerator<QaEvent, void, void> {
  const res = await fetch("/api/qa", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ question, sessionId }),
    signal,
  });

  for await (const evt of iterSse(res)) {
    if (evt.event === "done") return;
    if (evt.event === "error") {
      const parsed = safeJson(evt.data) as { error?: string } | null;
      throw new Error(parsed?.error ?? "qa stream errored");
    }
    if (evt.event === "tool_call") {
      const p = safeJson(evt.data) as ToolEvent | null;
      if (p) yield { type: "tool_call", tool: p };
      continue;
    }
    if (evt.event === "tool_result") {
      const p = safeJson(evt.data) as
        | { id: string; name: string; count?: number }
        | null;
      if (p) {
        yield {
          type: "tool_result",
          tool: { id: p.id, name: p.name, resultCount: p.count },
        };
      }
      continue;
    }
    if (evt.event === "citations") {
      const parsed = safeJson(evt.data) as CitationManifest | null;
      if (parsed) yield { type: "citations", citations: parsed };
      continue;
    }
    const parsed = safeJson(evt.data) as { delta?: string } | null;
    if (parsed?.delta) yield { type: "delta", delta: parsed.delta };
  }
}
