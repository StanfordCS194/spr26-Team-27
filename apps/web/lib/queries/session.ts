import "server-only";

import { bookmarks, sessionParticipants, users } from "@spr26/db";
import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";

// Resolve the public.users row id for the currently authenticated user.
// Mirrors requireStudent's match logic but returns null instead of
// redirecting, so callers (like server actions) can throw a structured
// error instead. Returns the directory id, which is what every downstream
// table FKs against — and is what RLS auth.uid() sees when the user signed
// up via the new trigger.
async function resolveStudentId(): Promise<string | null> {
  const supabase = await createClient();
  if (!supabase) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return null;

  const [row] = await db()
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, user.email))
    .limit(1);

  return row?.id ?? null;
}

// Idempotently find-or-create the session_participants row for the
// current student + session. Every engagement table FKs against this id,
// so guaranteeing it exists is the first thing the lecture layout does.
//
// Throws when there's no signed-in student so server actions surface a
// useful error instead of inserting orphaned rows.
export async function ensureParticipant(sessionId: string): Promise<string> {
  const studentId = await resolveStudentId();
  if (!studentId) {
    throw new Error("Not signed in");
  }

  const [existing] = await db()
    .select({ id: sessionParticipants.id })
    .from(sessionParticipants)
    .where(
      and(
        eq(sessionParticipants.sessionId, sessionId),
        eq(sessionParticipants.userId, studentId),
      ),
    )
    .limit(1);

  if (existing) return existing.id;

  // Race-safe insert: the unique constraint on (session_id, user_id) means
  // a concurrent insert from another tab will be caught by onConflict.
  const [created] = await db()
    .insert(sessionParticipants)
    .values({ sessionId, userId: studentId })
    .onConflictDoNothing({
      target: [sessionParticipants.sessionId, sessionParticipants.userId],
    })
    .returning({ id: sessionParticipants.id });

  if (created) return created.id;

  // The conflict path won — re-read to get the existing row's id.
  const [after] = await db()
    .select({ id: sessionParticipants.id })
    .from(sessionParticipants)
    .where(
      and(
        eq(sessionParticipants.sessionId, sessionId),
        eq(sessionParticipants.userId, studentId),
      ),
    )
    .limit(1);

  if (!after) throw new Error("Failed to ensure session participant");
  return after.id;
}

// Initial list of transcript_item ids this participant has bookmarked. The
// transcript panel hydrates its local set from this so a returning student
// sees their previous bookmarks immediately.
export async function getBookmarkedTranscriptIds(
  participantId: string,
): Promise<string[]> {
  const rows = await db()
    .select({ transcriptItemId: bookmarks.transcriptItemId })
    .from(bookmarks)
    .where(eq(bookmarks.participantId, participantId));
  return rows.map((r) => r.transcriptItemId);
}
