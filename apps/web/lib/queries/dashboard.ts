import "server-only";

import {
  courses,
  enrollments,
  sessions,
  type Course,
  type Session,
} from "@spr26/db";
import { and, desc, eq, inArray } from "drizzle-orm";

import { db } from "@/lib/db";

export interface CourseWithSessions {
  course: Course;
  liveSession: Session | null;
  recentSessions: Session[];
}

const RECENT_SESSION_LIMIT = 5;

// Dashboard payload for a single student: every course they're enrolled in,
// with the active live session (if any) and the most recent sessions surfaced
// for quick re-entry. One round trip per slice keeps the query plan obvious;
// the dashboard fans out to N small lists rather than a single mega-join.
export async function getDashboardForStudent(
  studentId: string,
): Promise<CourseWithSessions[]> {
  const enrolled = await db()
    .select({ course: courses })
    .from(enrollments)
    .innerJoin(courses, eq(courses.id, enrollments.courseId))
    .where(eq(enrollments.userId, studentId))
    .orderBy(courses.title);

  if (enrolled.length === 0) return [];

  const courseIds = enrolled.map((row) => row.course.id);

  // Pull every relevant session in one query, then bucket by course in JS.
  // For a student enrolled in a handful of courses this is cheaper than N+1
  // queries and the result set is bounded by `RECENT_SESSION_LIMIT * |courses|`
  // once we filter in memory.
  const allSessions = await db()
    .select()
    .from(sessions)
    .where(inArray(sessions.courseId, courseIds))
    .orderBy(desc(sessions.startedAt), desc(sessions.createdAt));

  const byCourse = new Map<string, Session[]>();
  for (const s of allSessions) {
    const list = byCourse.get(s.courseId) ?? [];
    list.push(s);
    byCourse.set(s.courseId, list);
  }

  return enrolled.map(({ course }) => {
    const all = byCourse.get(course.id) ?? [];
    const liveSession = all.find((s) => s.status === "live") ?? null;
    const recentSessions = all
      .filter((s) => s.status === "ended")
      .slice(0, RECENT_SESSION_LIMIT);
    return { course, liveSession, recentSessions };
  });
}

export interface CourseDetail {
  course: Course;
  liveSession: Session | null;
  upcomingSessions: Session[];
  pastSessions: Session[];
  allSessions: Session[];
}

// Full session breakdown for one course, scoped to a student who must be
// enrolled in it. Returns null when the slug doesn't exist or the student
// isn't enrolled — the page layer turns that into a notFound() / redirect.
export async function getCourseForStudent(
  studentId: string,
  slug: string,
): Promise<CourseDetail | null> {
  const [course] = await db()
    .select()
    .from(courses)
    .where(eq(courses.slug, slug))
    .limit(1);

  if (!course) return null;

  const [enrollment] = await db()
    .select({ id: enrollments.id })
    .from(enrollments)
    .where(
      and(
        eq(enrollments.userId, studentId),
        eq(enrollments.courseId, course.id),
      ),
    )
    .limit(1);

  if (!enrollment) return null;

  const all = await db()
    .select()
    .from(sessions)
    .where(eq(sessions.courseId, course.id))
    .orderBy(desc(sessions.startedAt), desc(sessions.createdAt));

  const liveSession = all.find((s) => s.status === "live") ?? null;
  const upcomingSessions = all.filter((s) => s.status === "scheduled");
  const pastSessions = all.filter((s) => s.status === "ended");

  return {
    course,
    liveSession,
    upcomingSessions,
    pastSessions,
    allSessions: all,
  };
}

export interface SessionContext {
  course: Course;
  session: Session;
}

// Resolve a session for the in-lecture views: confirms the student is
// enrolled in the parent course, confirms the session belongs to that
// course, and returns both records so the layout can render headers and the
// sidebar can highlight the active session. Returns null on any mismatch so
// the page can fall back to notFound().
export async function getSessionForStudent(
  studentId: string,
  courseSlug: string,
  sessionId: string,
): Promise<SessionContext | null> {
  const [course] = await db()
    .select()
    .from(courses)
    .where(eq(courses.slug, courseSlug))
    .limit(1);

  if (!course) return null;

  const [enrollment] = await db()
    .select({ id: enrollments.id })
    .from(enrollments)
    .where(
      and(
        eq(enrollments.userId, studentId),
        eq(enrollments.courseId, course.id),
      ),
    )
    .limit(1);

  if (!enrollment) return null;

  const [session] = await db()
    .select()
    .from(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.courseId, course.id)))
    .limit(1);

  if (!session) return null;

  return { course, session };
}
