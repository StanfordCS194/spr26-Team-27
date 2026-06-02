import "server-only";

import { courses, sessions, type Course, type Session } from "@spr26/db";
import { and, desc, eq, inArray } from "drizzle-orm";

import { db } from "@/lib/db";

export interface InstructorCourseSummary {
  course: Course;
  liveSession: Session | null;
  lectureCount: number;
}

// Every course owned by this instructor, with its live session (if any) and a
// lecture count for the dashboard cards.
export async function getCoursesForInstructor(
  instructorId: string,
): Promise<InstructorCourseSummary[]> {
  const owned = await db()
    .select()
    .from(courses)
    .where(eq(courses.instructorId, instructorId))
    .orderBy(courses.title);

  if (owned.length === 0) return [];

  // Fetch sessions for all owned courses in one pass, bucket by course in JS.
  const ids = owned.map((c) => c.id);
  const rows = await db()
    .select()
    .from(sessions)
    .where(inArray(sessions.courseId, ids))
    .orderBy(desc(sessions.createdAt));
  const byCourse = new Map<string, Session[]>();
  for (const s of rows) {
    const list = byCourse.get(s.courseId) ?? [];
    list.push(s);
    byCourse.set(s.courseId, list);
  }

  return owned.map((course) => {
    const list = byCourse.get(course.id) ?? [];
    return {
      course,
      liveSession: list.find((s) => s.status === "live") ?? null,
      lectureCount: list.length,
    };
  });
}

export interface InstructorCourseDetail {
  course: Course;
  liveSessions: Session[];
  scheduledSessions: Session[];
  endedSessions: Session[];
  allSessions: Session[];
}

// A single course the instructor owns, with its lectures bucketed by status.
// Returns null when the slug doesn't exist or isn't owned by this instructor.
export async function getCourseForInstructor(
  instructorId: string,
  slug: string,
): Promise<InstructorCourseDetail | null> {
  const [course] = await db()
    .select()
    .from(courses)
    .where(and(eq(courses.slug, slug), eq(courses.instructorId, instructorId)))
    .limit(1);
  if (!course) return null;

  const all = await db()
    .select()
    .from(sessions)
    .where(eq(sessions.courseId, course.id))
    .orderBy(desc(sessions.startedAt), desc(sessions.createdAt));

  return {
    course,
    liveSessions: all.filter((s) => s.status === "live"),
    scheduledSessions: all.filter((s) => s.status === "scheduled"),
    endedSessions: all.filter((s) => s.status === "ended"),
    allSessions: all,
  };
}

export interface InstructorSessionContext {
  course: Course;
  session: Session;
}

// Resolve a lecture for the instructor lecture view: confirms ownership of the
// parent course and that the session belongs to it. Returns null on mismatch.
export async function getSessionForInstructor(
  instructorId: string,
  courseSlug: string,
  sessionId: string,
): Promise<InstructorSessionContext | null> {
  const [course] = await db()
    .select()
    .from(courses)
    .where(
      and(eq(courses.slug, courseSlug), eq(courses.instructorId, instructorId)),
    )
    .limit(1);
  if (!course) return null;

  const [session] = await db()
    .select()
    .from(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.courseId, course.id)))
    .limit(1);
  if (!session) return null;

  return { course, session };
}
