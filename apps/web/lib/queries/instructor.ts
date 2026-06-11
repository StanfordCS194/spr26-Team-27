import "server-only";

import {
  courses,
  questions,
  quickPromptSignals,
  sessions,
  type Course,
  type Session,
} from "@spr26/db";
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
  analytics: InstructorCourseAnalytics;
}

export interface InstructorCourseAnalytics {
  lectureCount: number;
  totalQuestions: number;
  totalSignals: number;
  averageQuestionsPerLecture: number;
  busiestLectureTitle: string | null;
  busiestLectureQuestionCount: number;
  topSignal: string | null;
  topSignalCount: number;
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
    analytics: await getCourseAnalytics(all),
  };
}

async function getCourseAnalytics(
  allSessions: readonly Session[],
): Promise<InstructorCourseAnalytics> {
  if (allSessions.length === 0) {
    return {
      lectureCount: 0,
      totalQuestions: 0,
      totalSignals: 0,
      averageQuestionsPerLecture: 0,
      busiestLectureTitle: null,
      busiestLectureQuestionCount: 0,
      topSignal: null,
      topSignalCount: 0,
    };
  }

  const ids = allSessions.map((session) => session.id);
  const [questionRows, signalRows] = await Promise.all([
    db()
      .select({ sessionId: questions.sessionId })
      .from(questions)
      .where(inArray(questions.sessionId, ids)),
    db()
      .select({
        sessionId: quickPromptSignals.sessionId,
        promptType: quickPromptSignals.promptType,
      })
      .from(quickPromptSignals)
      .where(inArray(quickPromptSignals.sessionId, ids)),
  ]);

  const questionCounts = new Map<string, number>();
  for (const q of questionRows) {
    questionCounts.set(q.sessionId, (questionCounts.get(q.sessionId) ?? 0) + 1);
  }

  const signalCounts = new Map<string, number>();
  for (const signal of signalRows) {
    signalCounts.set(
      signal.promptType,
      (signalCounts.get(signal.promptType) ?? 0) + 1,
    );
  }

  const busiest = allSessions
    .map((session) => ({
      session,
      count: questionCounts.get(session.id) ?? 0,
    }))
    .sort((a, b) => b.count - a.count)[0];
  const topSignal =
    [...signalCounts.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;

  return {
    lectureCount: allSessions.length,
    totalQuestions: questionRows.length,
    totalSignals: signalRows.length,
    averageQuestionsPerLecture:
      Math.round((questionRows.length / allSessions.length) * 10) / 10,
    busiestLectureTitle: busiest?.count ? busiest.session.title : null,
    busiestLectureQuestionCount: busiest?.count ?? 0,
    topSignal: topSignal?.[0] ?? null,
    topSignalCount: topSignal?.[1] ?? 0,
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
