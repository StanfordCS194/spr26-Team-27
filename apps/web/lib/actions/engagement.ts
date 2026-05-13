"use server";

import {
  bookmarks,
  questions,
  quickPromptSignals,
  type Question,
} from "@spr26/db";
import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { ensureParticipant } from "@/lib/queries/session";

type QuickPromptType =
  | "im_lost"
  | "re_explain"
  | "what_just_happened"
  | "give_example";

// Toggle a bookmark on a single transcript_item for the current student in
// a session. Returns the new state so the client can resolve optimistic
// disagreement (e.g. multiple devices toggling at once).
export async function toggleBookmark(
  sessionId: string,
  transcriptItemId: string,
): Promise<{ bookmarked: boolean }> {
  const participantId = await ensureParticipant(sessionId);

  const [existing] = await db()
    .select({ id: bookmarks.id })
    .from(bookmarks)
    .where(
      and(
        eq(bookmarks.participantId, participantId),
        eq(bookmarks.transcriptItemId, transcriptItemId),
      ),
    )
    .limit(1);

  if (existing) {
    await db().delete(bookmarks).where(eq(bookmarks.id, existing.id));
    return { bookmarked: false };
  }

  await db().insert(bookmarks).values({
    sessionId,
    participantId,
    transcriptItemId,
  });
  return { bookmarked: true };
}

// Record a tap on one of the quick-prompt chips (or the "I'm lost" button,
// which is the im_lost variant). anchorTranscriptItemId is the latest line
// the student had on screen, which feeds the instructor-side confusion
// threshold indicator (PRD F19).
export async function recordQuickPrompt(
  sessionId: string,
  promptType: QuickPromptType,
  anchorTranscriptItemId: string | null,
): Promise<void> {
  const participantId = await ensureParticipant(sessionId);
  await db().insert(quickPromptSignals).values({
    sessionId,
    participantId,
    promptType,
    anchorTranscriptItemId,
  });
}

// Persist a question (immediate or deferred). The /api/qa endpoint still
// owns the actual streaming + answer generation — this is just the row
// that surfaces in the post-session summary.
export async function persistQuestion(
  sessionId: string,
  content: string,
  mode: "immediate" | "deferred",
  anchorTranscriptItemId: string | null,
): Promise<Question> {
  const trimmed = content.trim();
  if (!trimmed) {
    throw new Error("Question content is required");
  }

  const participantId = await ensureParticipant(sessionId);
  const [row] = await db()
    .insert(questions)
    .values({
      sessionId,
      participantId,
      content: trimmed,
      mode,
      anchorTranscriptItemId,
    })
    .returning();

  if (!row) throw new Error("Failed to persist question");
  return row;
}
