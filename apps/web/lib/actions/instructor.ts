"use server";

import { conceptChecks, courses, questions, sessions } from "@spr26/db";
import { and, eq, isNull } from "drizzle-orm";
import { redirect } from "next/navigation";

import { requireInstructor } from "@/lib/auth";
import { db } from "@/lib/db";

function field(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v : "";
}

// Create a new course owned by the signed-in instructor. The slug is the
// human-typed "course code" students join with — normalized to lowercase and
// stripped of any accidental "/teach/" prefix. Bounces back with ?error when
// the code is already taken by someone else.
export async function createCourse(formData: FormData): Promise<void> {
  const me = await requireInstructor();
  const slug = field(formData, "course_slug")
    .trim()
    .replace(/^\/?(learn\/|teach\/)?/, "")
    .toLowerCase();
  const title = field(formData, "course_title").trim() || slug;
  if (!slug) redirect("/teach?error=missing_slug");

  const [existing] = await db()
    .select({ id: courses.id, instructorId: courses.instructorId })
    .from(courses)
    .where(eq(courses.slug, slug))
    .limit(1);

  if (existing && existing.instructorId !== me.id) {
    redirect(`/teach?error=slug_taken&slug=${encodeURIComponent(slug)}`);
  }
  if (!existing) {
    await db()
      .insert(courses)
      .values({ slug, title, instructorId: me.id })
      .onConflictDoNothing({ target: courses.slug });
  }

  redirect(`/teach/${slug}`);
}

// Schedule a new lecture (a `sessions` row) under a course the instructor
// owns. Created in the `scheduled` state; the SessionBar flips it to `live`
// when recording starts.
export async function createLecture(formData: FormData): Promise<void> {
  const me = await requireInstructor();
  const slug = field(formData, "course_slug").trim().toLowerCase();
  const title = field(formData, "title").trim();
  if (!slug || !title) redirect(`/teach/${slug}?error=missing_title`);

  const [course] = await db()
    .select({ id: courses.id })
    .from(courses)
    .where(and(eq(courses.slug, slug), eq(courses.instructorId, me.id)))
    .limit(1);
  if (!course) redirect("/teach?error=not_owner");

  await db()
    .insert(sessions)
    .values({ courseId: course.id, title, status: "scheduled" });

  redirect(`/teach/${slug}`);
}

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

export async function publishConceptCheck(
  sessionId: string,
  prompt: string,
  choices: string[],
): Promise<void> {
  const me = await requireInstructor();
  const trimmedPrompt = prompt.trim();
  const cleanedChoices = choices.map((choice) => choice.trim()).filter(Boolean);

  if (!trimmedPrompt) throw new Error("Concept check prompt is required.");
  if (cleanedChoices.length < 2) {
    throw new Error("Add at least two answer choices.");
  }

  const [owned] = await db()
    .select({ id: sessions.id })
    .from(sessions)
    .innerJoin(courses, eq(sessions.courseId, courses.id))
    .where(and(eq(sessions.id, sessionId), eq(courses.instructorId, me.id)))
    .limit(1);

  if (!owned) throw new Error("You do not own this lecture.");

  await db().insert(conceptChecks).values({
    sessionId,
    prompt: trimmedPrompt,
    kind: "multiple_choice",
    choices: cleanedChoices,
  });
}
