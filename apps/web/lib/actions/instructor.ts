"use server";

import { questions, sessions } from "@spr26/db";
import { and, eq, isNull } from "drizzle-orm";

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

// Stamp `answered_at = now()` on a question so the instructor's feed can hide
// it (or visually demote it) once they've spoken to the question in lecture.
// Guarded against double-marking via the `IS NULL` clause so a re-click is a
// no-op rather than overwriting the original timestamp.
//
// TODO(auth): same caveat as startSession — gate on the instructor owning the
// session's course once instructor auth lands.
export async function markQuestionAnswered(questionId: string): Promise<void> {
  await db()
    .update(questions)
    .set({ answeredAt: new Date() })
    .where(and(eq(questions.id, questionId), isNull(questions.answeredAt)));
}
