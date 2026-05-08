import { Hono } from "hono";
import { streamSSE } from "hono/streaming";

export interface TranscriptLine {
  timestampSeconds: number;
  content: string;
}

const sessionBuffers = new Map<string, TranscriptLine[]>();
const sessionListeners = new Map<string, Set<(line: TranscriptLine) => void>>();

export function appendTranscript(sessionId: string, line: TranscriptLine) {
  let buf = sessionBuffers.get(sessionId);
  if (!buf) {
    buf = [];
    sessionBuffers.set(sessionId, buf);
  }
  buf.push(line);

  const listeners = sessionListeners.get(sessionId);
  if (listeners) {
    for (const cb of listeners) cb(line);
  }
}

export function getTranscriptBuffer(sessionId: string): TranscriptLine[] {
  return sessionBuffers.get(sessionId) ?? [];
}

export function clearSession(sessionId: string) {
  sessionBuffers.delete(sessionId);
  sessionListeners.delete(sessionId);
}

const liveTranscript = new Hono();

liveTranscript.get("/:sessionId", (c) => {
  const { sessionId } = c.req.param();

  c.header("cache-control", "no-cache");
  c.header("x-accel-buffering", "no");

  return streamSSE(c, async (stream) => {
    const existing = getTranscriptBuffer(sessionId);
    for (const line of existing) {
      await stream.writeSSE({
        event: "transcript",
        data: JSON.stringify(line),
      });
    }

    const onLine = async (line: TranscriptLine) => {
      try {
        await stream.writeSSE({
          event: "transcript",
          data: JSON.stringify(line),
        });
      } catch {
        // client disconnected
      }
    };

    let listeners = sessionListeners.get(sessionId);
    if (!listeners) {
      listeners = new Set();
      sessionListeners.set(sessionId, listeners);
    }
    listeners.add(onLine);

    stream.onAbort(() => {
      listeners!.delete(onLine);
    });

    // keep connection alive
    while (true) {
      await stream.writeSSE({ event: "ping", data: "" });
      await stream.sleep(15000);
    }
  });
});

export default liveTranscript;
