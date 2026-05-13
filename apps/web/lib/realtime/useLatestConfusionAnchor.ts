"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";

export interface LatestConfusionAnchor {
  transcriptItemId: string;
  createdAt: number;
}

// Returns the most recent quick_prompt_signals row that has a non-null
// anchor_transcript_item_id, for use as a "Jump to where students got lost"
// pointer in the instructor UI. Updates whenever a new tap with a non-null
// anchor arrives.
export function useLatestConfusionAnchor(
  sessionId: string | null,
): LatestConfusionAnchor | null {
  const [latest, setLatest] = useState<LatestConfusionAnchor | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    const supabase = createClient();
    if (!supabase) return;
    let cancelled = false;

    void (async () => {
      const { data } = await supabase
        .from("quick_prompt_signals")
        .select("anchor_transcript_item_id, created_at")
        .eq("session_id", sessionId)
        .not("anchor_transcript_item_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(1);
      if (cancelled || !data || data.length === 0) return;
      const row = data[0];
      setLatest({
        transcriptItemId: row.anchor_transcript_item_id as string,
        createdAt: new Date(row.created_at as string).getTime(),
      });
    })();

    const channel = supabase
      .channel(`confusion_anchor:${sessionId}:${crypto.randomUUID()}`)
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
            anchor_transcript_item_id: string | null;
            created_at: string;
          };
          if (!row.anchor_transcript_item_id) return;
          const createdAt = new Date(row.created_at).getTime();
          setLatest((prev) =>
            prev && prev.createdAt > createdAt
              ? prev
              : {
                  transcriptItemId: row.anchor_transcript_item_id!,
                  createdAt,
                },
          );
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [sessionId]);

  return latest;
}
