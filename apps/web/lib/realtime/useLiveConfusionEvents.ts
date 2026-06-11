"use client";

import type { ConfusionSignal, PromptType } from "@/lib/classroom-intelligence";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";

export function useLiveConfusionEvents(sessionId: string | null) {
  const [events, setEvents] = useState<ConfusionSignal[]>([]);

  useEffect(() => {
    if (!sessionId) return;
    const supabase = createClient();
    if (!supabase) return;
    let cancelled = false;

    void (async () => {
      const { data } = await supabase
        .from("quick_prompt_signals")
        .select("id, prompt_type, created_at, anchor_transcript_item_id")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: false })
        .limit(200);
      if (!cancelled && data) setEvents(data);
    })();

    const channel = supabase
      .channel(`confusion-events:${sessionId}:${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "quick_prompt_signals",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          const row = payload.new as {
            id: string;
            prompt_type: PromptType;
            created_at: string;
            anchor_transcript_item_id: string | null;
          };
          setEvents((prev) =>
            prev.some((e) => e.id === row.id) ? prev : [row, ...prev],
          );
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [sessionId]);

  return events;
}
