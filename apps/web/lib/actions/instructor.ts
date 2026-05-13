"use server";

import { courses, sessions } from "@spr26/db";
import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { requireInstructor } from "@/lib/auth";
import { db } from "@/lib/db";

// Flip a session into the 'live' state and stamp startedAt. Idempotent —
// calling on an already-live session just refreshes startedAt to "now",
// which is fine for restarts (the wall-clock matters less than the status).
//
// TODO(auth): once instructor auth lands, gate on auth.uid() ===
// sessions.course.instructor_id. For tomorrow's demo this is open so the
// existing instructor SessionBar can drive the lifecycle without an auth
// wiring blocker.
export async function startSession(sessionId: string): Promise<void> {
  await db()
    .update(sessions)
    .set({ status: "live", startedAt: new Date() })
    .where(eq(sessions.id, sessionId));
}

// Flip a session into 'ended' and stamp endedAt. Students see the session
// move from the live banner into past sessions on their next dashboard
// load; mid-session transcript subscribers stop receiving new lines
// because the recorder stopped — the row state change is what tells the
// rest of the system "this is over."
export async function endSession(sessionId: string): Promise<void> {
  await db()
    .update(sessions)
    .set({ status: "ended", endedAt: new Date() })
    .where(eq(sessions.id, sessionId));
}

export async function createSession(formData: FormData): Promise<void> {
  const instructor = await requireInstructor();
  const courseId = formData.get("courseId") as string;
  const title = (formData.get("title") as string)?.trim();

  if (!courseId || !title) return;

  const [course] = await db()
    .select()
    .from(courses)
    .where(
      and(eq(courses.id, courseId), eq(courses.instructorId, instructor.id)),
    )
    .limit(1);

  if (!course) return;

  const [session] = await db()
    .insert(sessions)
    .values({
      courseId: course.id,
      title,
      status: "scheduled",
    })
    .returning({ id: sessions.id });

  redirect(`/teach/${course.slug}/lectures/${session.id}`);
}
