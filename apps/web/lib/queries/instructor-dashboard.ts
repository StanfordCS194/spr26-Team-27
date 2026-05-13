import "server-only";

import { courses, sessions, type Course, type Session } from "@spr26/db";
import { desc, eq } from "drizzle-orm";

import { db } from "@/lib/db";

export interface InstructorCourseWithSessions {
  course: Course;
  liveSession: Session | null;
  recentSessions: Session[];
}

export async function getCoursesForInstructor(
  instructorId: string,
): Promise<InstructorCourseWithSessions[]> {
  const owned = await db()
    .select()
    .from(courses)
    .where(eq(courses.instructorId, instructorId))
    .orderBy(courses.title);

  if (owned.length === 0) return [];

  const result: InstructorCourseWithSessions[] = [];

  for (const course of owned) {
    const all = await db()
      .select()
      .from(sessions)
      .where(eq(sessions.courseId, course.id))
      .orderBy(desc(sessions.startedAt), desc(sessions.createdAt));

    const liveSession = all.find((s) => s.status === "live") ?? null;
    const recentSessions = all.filter((s) => s.status === "ended").slice(0, 5);

    result.push({ course, liveSession, recentSessions });
  }

  return result;
}

export async function getSessionsForCourse(
  courseId: string,
): Promise<{ live: Session | null; scheduled: Session[]; past: Session[] }> {
  const all = await db()
    .select()
    .from(sessions)
    .where(eq(sessions.courseId, courseId))
    .orderBy(desc(sessions.startedAt), desc(sessions.createdAt));

  return {
    live: all.find((s) => s.status === "live") ?? null,
    scheduled: all.filter((s) => s.status === "scheduled"),
    past: all.filter((s) => s.status === "ended"),
  };
}
