"use client";

import { toggleBookmark as toggleBookmarkAction } from "@/lib/actions/engagement";
import { useLiveTranscript } from "@/lib/realtime/useLiveTranscript";
import type { TranscriptItem } from "@/types/transcript";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

export interface DeferredQuestion {
  id: string;
  content: string;
}

interface SessionState {
  sessionId: string;
  sessionStatus: "scheduled" | "live" | "ended";
  // Participant row id for the current student in this session. Every
  // engagement action (bookmark, quick prompt, question) writes against
  // this id; the layout guarantees it exists before the provider mounts.
  participantId: string;
  lines: TranscriptItem[];
  // True for ended sessions — no more lines are coming. Live sessions stay
  // false until the instructor ends them.
  done: boolean;
  // Latest revealed transcript line id — used as the `anchor` field on
  // every engagement write so the instructor side can cluster signals to
  // a moment in the lecture.
  currentAnchorId: string | null;
  // Bookmarked transcript_item ids, seeded from the server. Optimistic UI
  // updates flip this set immediately; the server action reconciles.
  bookmarkedIds: ReadonlySet<string>;
  toggleBookmark: (transcriptItemId: string) => void;
  // Deferred questions queued for after lecture, seeded from the server so
  // a refresh doesn't drop them.
  deferredQuestions: readonly DeferredQuestion[];
  addDeferredQuestion: (q: DeferredQuestion) => void;
}

const StudentSessionContext = createContext<SessionState | null>(null);

export function StudentSessionProvider({
  sessionId,
  sessionStatus,
  participantId,
  initialBookmarkedIds,
  initialDeferredQuestions,
  children,
}: {
  sessionId: string;
  sessionStatus: "scheduled" | "live" | "ended";
  participantId: string;
  initialBookmarkedIds: readonly string[];
  initialDeferredQuestions: readonly DeferredQuestion[];
  children: React.ReactNode;
}) {
  const lines = useLiveTranscript(sessionId);
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(
    () => new Set(initialBookmarkedIds),
  );
  const [deferredQuestions, setDeferredQuestions] = useState<
    DeferredQuestion[]
  >(() => [...initialDeferredQuestions]);

  // Optimistic toggle: flip locally, then call the server action and
  // reconcile if the response disagrees (e.g. a concurrent toggle from
  // another tab landed first).
  const toggleBookmark = useCallback(
    (transcriptItemId: string) => {
      setBookmarkedIds((prev) => {
        const next = new Set(prev);
        if (next.has(transcriptItemId)) next.delete(transcriptItemId);
        else next.add(transcriptItemId);
        return next;
      });
      void (async () => {
        try {
          const { bookmarked } = await toggleBookmarkAction(
            sessionId,
            transcriptItemId,
          );
          setBookmarkedIds((prev) => {
            const has = prev.has(transcriptItemId);
            if (has === bookmarked) return prev;
            const next = new Set(prev);
            if (bookmarked) next.add(transcriptItemId);
            else next.delete(transcriptItemId);
            return next;
          });
        } catch (err) {
          // Roll back the optimistic flip on failure so the UI reflects
          // reality (probably an auth / RLS error).
          console.error("toggleBookmark failed", err);
          setBookmarkedIds((prev) => {
            const next = new Set(prev);
            if (next.has(transcriptItemId)) next.delete(transcriptItemId);
            else next.add(transcriptItemId);
            return next;
          });
        }
      })();
    },
    [sessionId],
  );

  const addDeferredQuestion = useCallback((q: DeferredQuestion) => {
    setDeferredQuestions((prev) =>
      prev.some((p) => p.id === q.id) ? prev : [...prev, q],
    );
  }, []);

  const currentAnchorId = lines.length > 0 ? lines[lines.length - 1].id : null;

  const value = useMemo<SessionState>(
    () => ({
      sessionId,
      sessionStatus,
      participantId,
      lines,
      done: sessionStatus === "ended",
      currentAnchorId,
      bookmarkedIds,
      toggleBookmark,
      deferredQuestions,
      addDeferredQuestion,
    }),
    [
      sessionId,
      sessionStatus,
      participantId,
      lines,
      currentAnchorId,
      bookmarkedIds,
      toggleBookmark,
      deferredQuestions,
      addDeferredQuestion,
    ],
  );

  return (
    <StudentSessionContext.Provider value={value}>
      {children}
    </StudentSessionContext.Provider>
  );
}

export function useStudentSession(): SessionState {
  const ctx = useContext(StudentSessionContext);
  if (!ctx) {
    throw new Error(
      "useStudentSession must be used inside StudentSessionProvider",
    );
  }
  return ctx;
}
