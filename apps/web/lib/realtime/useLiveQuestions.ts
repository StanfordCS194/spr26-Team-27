"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";

export interface LiveQuestion {
  id: string;
  content: string;
  mode: "immediate" | "deferred";
  asked_at: string;
  // The transcript_item id that was on screen when the student asked the
  // question. Used by the instructor UI to render a "@HH:MM" pill that
  // jumps the transcript to where the student got lost.
  anchor_transcript_item_id: string | null;
  // ISO timestamp once an instructor marks the question answered. NULL =
  // still open. Driven by markQuestionAnswered() in lib/actions/instructor.
  answered_at: string | null;
}

export function useLiveQuestions(sessionId: string | null) {
  const [questions, setQuestions] = useState<LiveQuestion[]>([]);

  useEffect(() => {
    if (!sessionId) return;
    const supabase = createClient();
    if (!supabase) return;
    let cancelled = false;

    void (async () => {
      const { data } = await supabase
        .from("questions")
        .select(
          "id, content, mode, asked_at, anchor_transcript_item_id, answered_at",
        )
        .eq("session_id", sessionId)
        .order("asked_at", { ascending: false })
        .limit(50);
      if (!cancelled && data) setQuestions(data);
    })();

    const channel = supabase
      .channel(`questions:${sessionId}:${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "questions",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          const row = payload.new as LiveQuestion;
          setQuestions((prev) =>
            prev.some((p) => p.id === row.id) ? prev : [row, ...prev],
          );
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "questions",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          const row = payload.new as LiveQuestion;
          setQuestions((prev) =>
            prev.map((p) => (p.id === row.id ? { ...p, ...row } : p)),
          );
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [sessionId]);

  return questions;
}
