import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocketServer, WebSocket } from "ws";
import db from "./db.ts";
import { appendTranscript } from "./live-transcript.ts";
import { verifyToken } from "./auth-middleware.ts";

const wss = new WebSocketServer({ noServer: true });

const sessionStartTimes = new Map<string, number>();

wss.on("connection", (ws: WebSocket, sessionId: string) => {
  if (!sessionStartTimes.has(sessionId)) {
    sessionStartTimes.set(sessionId, Date.now());
  }

  ws.on("message", async (data: Buffer) => {
    const startTime = sessionStartTimes.get(sessionId) ?? Date.now();
    const elapsedSeconds = (Date.now() - startTime) / 1000;

    try {
      const blob = new Blob([data], { type: "audio/webm" });
      const file = new File([blob], "audio.webm", { type: "audio/webm" });

      const formData = new FormData();
      formData.append("file", file);
      formData.append("model", "whisper-1");
      formData.append("response_format", "text");

      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        console.error("OPENAI_API_KEY not set for Whisper transcription");
        return;
      }

      const resp = await fetch(
        "https://api.openai.com/v1/audio/transcriptions",
        {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}` },
          body: formData,
        },
      );

      if (!resp.ok) {
        console.error("Whisper error:", resp.status, await resp.text());
        return;
      }

      const text = (await resp.text()).trim();
      if (!text) return;

      const line = { timestampSeconds: elapsedSeconds, content: text };
      appendTranscript(sessionId, line);

      db.prepare(
        "INSERT INTO transcript_segments (session_id, timestamp_seconds, content) VALUES (?, ?, ?)",
      ).run(sessionId, elapsedSeconds, text);

      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "transcript", ...line }));
      }
    } catch (err) {
      console.error("Transcription error:", err);
    }
  });

  ws.on("close", () => {
    // cleanup if needed
  });
});

export function handleUpgrade(
  req: IncomingMessage,
  socket: Duplex,
  head: Buffer,
) {
  const url = new URL(req.url ?? "/", "http://localhost");
  const match = url.pathname.match(/^\/api\/audio\/(.+)$/);
  if (!match) {
    socket.destroy();
    return;
  }

  const sessionId = match[1];

  const token = url.searchParams.get("token");
  if (!token) {
    socket.destroy();
    return;
  }

  verifyToken(token).then((payload) => {
    if (!payload) {
      socket.destroy();
      return;
    }

    const session = db
      .prepare(
        `SELECT s.id FROM sessions s
         JOIN courses c ON s.course_id = c.id
         WHERE s.id = ? AND c.instructor_id = ? AND s.is_active = 1`,
      )
      .get(sessionId, payload.sub) as { id: string } | undefined;

    if (!session) {
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, sessionId);
    });
  });
}
