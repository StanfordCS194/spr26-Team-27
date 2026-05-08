import { Hono } from "hono";
import db from "./db.ts";

const slugApi = new Hono();

slugApi.get("/:slug", (c) => {
  const { slug } = c.req.param();

  const instructor = db
    .prepare("SELECT id, display_name, slug FROM instructors WHERE slug = ?")
    .get(slug) as { id: string; display_name: string; slug: string } | undefined;
  if (!instructor) return c.json({ error: "not found" }, 404);

  const course = db
    .prepare("SELECT id, name FROM courses WHERE instructor_id = ?")
    .get(instructor.id) as { id: string; name: string } | undefined;

  const activeSession = course
    ? (db
        .prepare("SELECT id, title, started_at FROM sessions WHERE course_id = ? AND is_active = 1")
        .get(course.id) as { id: string; title: string; started_at: string } | undefined)
    : undefined;

  const pastSessions = course
    ? (db
        .prepare(
          "SELECT id, title, started_at, ended_at FROM sessions WHERE course_id = ? AND is_active = 0 ORDER BY started_at DESC LIMIT 20",
        )
        .all(course.id) as Array<{
        id: string;
        title: string;
        started_at: string;
        ended_at: string;
      }>)
    : [];

  return c.json({
    instructor: { displayName: instructor.display_name, slug: instructor.slug },
    course: course ? { id: course.id, name: course.name } : null,
    activeSession: activeSession ?? null,
    pastSessions,
  });
});

export default slugApi;
