"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";

type Prompt = "im_lost" | "re_explain" | "what_just_happened" | "give_example";

export interface ConfusionTotals {
  im_lost: number;
  re_explain: number;
  what_just_happened: number;
  give_example: number;
}

const ZERO: ConfusionTotals = {
  im_lost: 0,
  re_explain: 0,
  what_just_happened: 0,
  give_example: 0,
};

// Rolling counts of quick_prompt_signals over the last `windowSeconds`.
// Re-tallies whenever an insert arrives or the window slides.
export function useLiveConfusion(sessionId: string | null, windowSeconds = 60) {
  const [totals, setTotals] = useState<ConfusionTotals>(ZERO);

  useEffect(() => {
    if (!sessionId) return;
    const supabase = createClient();
    if (!supabase) return;
    let cancelled = false;
    const events: { prompt_type: Prompt; createdAt: number }[] = [];

    const recompute = () => {
      const cutoff = Date.now() - windowSeconds * 1000;
      const counts: ConfusionTotals = { ...ZERO };
      for (const e of events) {
        if (e.createdAt < cutoff) continue;
        counts[e.prompt_type] += 1;
      }
      setTotals(counts);
    };

    void (async () => {
      const cutoffIso = new Date(
        Date.now() - windowSeconds * 1000,
      ).toISOString();
      const { data } = await supabase
        .from("quick_prompt_signals")
        .select("prompt_type, created_at")
        .eq("session_id", sessionId)
        .gte("created_at", cutoffIso);
      if (cancelled || !data) return;
      for (const row of data) {
        events.push({
          prompt_type: row.prompt_type as Prompt,
          createdAt: new Date(row.created_at).getTime(),
        });
      }
      recompute();
    })();

    const tick = setInterval(recompute, 5000);

    const channel = supabase
      .channel(`confusion:${sessionId}:${crypto.randomUUID()}`)
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
            prompt_type: Prompt;
            created_at: string;
          };
          events.push({
            prompt_type: row.prompt_type,
            createdAt: new Date(row.created_at).getTime(),
          });
          recompute();
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      clearInterval(tick);
      void supabase.removeChannel(channel);
    };
  }, [sessionId, windowSeconds]);

  return totals;
}
