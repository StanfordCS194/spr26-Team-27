"use client";

import { useDemoTranscript } from "@/lib/realtime/useDemoTranscript";
import type { TranscriptItem } from "@/types/transcript";
import { createContext, useContext } from "react";

interface SessionState {
  lines: TranscriptItem[];
  done: boolean;
}

const StudentSessionContext = createContext<SessionState | null>(null);

export function StudentSessionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { lines, done } = useDemoTranscript();
  return (
    <StudentSessionContext.Provider value={{ lines, done }}>
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
