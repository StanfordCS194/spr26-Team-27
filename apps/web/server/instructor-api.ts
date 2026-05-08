import { Hono } from "hono";
import { randomBytes } from "node:crypto";
import db from "./db.ts";
import { requireAuth, type AuthPayload } from "./auth-middleware.ts";

const instructorApi = new Hono<{ Variables: { instructor: AuthPayload } }>();

instructorApi.use("/*", requireAuth);

instructorApi.get("/courses", (c) => {
  const instructor = c.get("instructor");
  const courses = db
    .prepare("SELECT id, name, created_at FROM courses WHERE instructor_id = ?")
    .all(instructor.sub) as Array<{ id: string; name: string; created_at: string }>;
  return c.json({ courses });
});

instructorApi.get("/courses/:courseId/sessions", (c) => {
  const { courseId } = c.req.param();
  const instructor = c.get("instructor");

  const course = db
    .prepare("SELECT id FROM courses WHERE id = ? AND instructor_id = ?")
    .get(courseId, instructor.sub) as { id: string } | undefined;
  if (!course) return c.json({ error: "course not found" }, 404);

  const sessions = db
    .prepare(
      "SELECT id, title, started_at, ended_at, is_active FROM sessions WHERE course_id = ? ORDER BY started_at DESC",
    )
    .all(courseId) as Array<{
    id: string;
    title: string;
    started_at: string;
    ended_at: string | null;
    is_active: number;
  }>;
  return c.json({ sessions });
});

instructorApi.post("/courses/:courseId/sessions", async (c) => {
  const { courseId } = c.req.param();
  const instructor = c.get("instructor");

  const course = db
    .prepare("SELECT id FROM courses WHERE id = ? AND instructor_id = ?")
    .get(courseId, instructor.sub) as { id: string } | undefined;
  if (!course) return c.json({ error: "course not found" }, 404);

  const active = db
    .prepare("SELECT id FROM sessions WHERE course_id = ? AND is_active = 1")
    .get(courseId) as { id: string } | undefined;
  if (active) {
    return c.json({ error: "a session is already active", sessionId: active.id }, 409);
  }

  const body = await c.req.json<{ title?: string }>().catch(() => ({}));
  const sessionId = randomBytes(16).toString("hex");
  const title = body.title ?? `Lecture ${new Date().toLocaleDateString()}`;

  db.prepare(
    "INSERT INTO sessions (id, course_id, title) VALUES (?, ?, ?)",
  ).run(sessionId, courseId, title);

  return c.json({ sessionId, title }, 201);
});

instructorApi.patch("/sessions/:sessionId/end", (c) => {
  const { sessionId } = c.req.param();
  const instructor = c.get("instructor");

  const session = db
    .prepare(
      `SELECT s.id FROM sessions s
       JOIN courses c ON s.course_id = c.id
       WHERE s.id = ? AND c.instructor_id = ? AND s.is_active = 1`,
    )
    .get(sessionId, instructor.sub) as { id: string } | undefined;
  if (!session) return c.json({ error: "session not found or already ended" }, 404);

  db.prepare(
    "UPDATE sessions SET is_active = 0, ended_at = datetime('now') WHERE id = ?",
  ).run(sessionId);

  return c.json({ ok: true });
});

instructorApi.get("/sessions/:sessionId", (c) => {
  const { sessionId } = c.req.param();
  const instructor = c.get("instructor");

  const session = db
    .prepare(
      `SELECT s.id, s.course_id, s.title, s.started_at, s.ended_at, s.is_active
       FROM sessions s JOIN courses c ON s.course_id = c.id
       WHERE s.id = ? AND c.instructor_id = ?`,
    )
    .get(sessionId, instructor.sub) as {
    id: string;
    course_id: string;
    title: string;
    started_at: string;
    ended_at: string | null;
    is_active: number;
  } | undefined;
  if (!session) return c.json({ error: "session not found" }, 404);

  const segments = db
    .prepare(
      "SELECT timestamp_seconds, content FROM transcript_segments WHERE session_id = ? ORDER BY timestamp_seconds",
    )
    .all(sessionId) as Array<{ timestamp_seconds: number; content: string }>;

  return c.json({ session, transcript: segments });
});

export default instructorApi;
