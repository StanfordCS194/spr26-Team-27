"use client";

import { useLiveTranscript } from "@/lib/realtime/useLiveTranscript";
import type { TranscriptItem } from "@/types/transcript";
import { createContext, useContext } from "react";

interface SessionState {
  sessionId: string;
  sessionStatus: "scheduled" | "live" | "ended";
  // Participant row id for the current student in this session. Every
  // engagement action (bookmark, quick prompt, question) writes against
  // this id; the layout guarantees it exists before the provider mounts.
  participantId: string;
  // Server-loaded initial set of bookmarked transcript_item ids. The
  // transcript panel hydrates its local set from this so a returning
  // student sees their bookmarks immediately on render.
  initialBookmarkedIds: readonly string[];
  lines: TranscriptItem[];
  // True for ended sessions — no more lines are coming. Live sessions stay
  // false until the instructor ends them.
  done: boolean;
}

const StudentSessionContext = createContext<SessionState | null>(null);

export function StudentSessionProvider({
  sessionId,
  sessionStatus,
  participantId,
  initialBookmarkedIds,
  children,
}: {
  sessionId: string;
  sessionStatus: "scheduled" | "live" | "ended";
  participantId: string;
  initialBookmarkedIds: readonly string[];
  children: React.ReactNode;
}) {
  const lines = useLiveTranscript(sessionId);
  return (
    <StudentSessionContext.Provider
      value={{
        sessionId,
        sessionStatus,
        participantId,
        initialBookmarkedIds,
        lines,
        done: sessionStatus === "ended",
      }}
    >
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
