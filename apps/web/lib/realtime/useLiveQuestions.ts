"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";

export interface LiveQuestion {
  id: string;
  content: string;
  mode: "immediate" | "deferred";
  asked_at: string;
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
        .select("id, content, mode, asked_at")
        .eq("session_id", sessionId)
        .order("asked_at", { ascending: false })
        .limit(50);
      if (!cancelled && data) setQuestions(data as LiveQuestion[]);
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
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [sessionId]);

  return questions;
}
