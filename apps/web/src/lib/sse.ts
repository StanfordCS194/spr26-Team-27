// Shared Server-Sent Events parser. Both /api/qa (mocked AI answer) and
// /api/transcript (mocked live transcript) speak the same wire format:
//   event: <name>?
//   data: <utf-8 line>
//   <blank line>
// Yields one frame per blank-line-terminated block. Caller decides what to
// do with `event` and `data`.

export interface SseFrame {
  event: string;
  data: string;
}

export async function* iterSse(
  res: Response,
): AsyncGenerator<SseFrame, void, void> {
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `request failed: ${res.status}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) return;
    buffer += decoder.decode(value, { stream: true });

    let sep = buffer.indexOf("\n\n");
    while (sep !== -1) {
      yield parseFrame(buffer.slice(0, sep));
      buffer = buffer.slice(sep + 2);
      sep = buffer.indexOf("\n\n");
    }
  }
}

export function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function parseFrame(frame: string): SseFrame {
  let event = "message";
  const dataLines: string[] = [];
  for (const line of frame.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
  }
  return { event, data: dataLines.join("\n") };
}
