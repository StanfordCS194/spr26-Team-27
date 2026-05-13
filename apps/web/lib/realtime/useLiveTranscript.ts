"use client";

import { createClient } from "@/lib/supabase/client";
import type { TranscriptItem } from "@/types/transcript";
import { useEffect, useState } from "react";

interface DbRow {
  id: string;
  sequence: number;
  timestamp_seconds: number;
  content: string;
}

function rowToItem(
  row: DbRow,
): TranscriptItem & {
  id: string;
  sequence: number;
  timestampSeconds: number;
} {
  const m = Math.floor(row.timestamp_seconds / 60);
  const s = row.timestamp_seconds % 60;
  return {
    id: row.id,
    sequence: row.sequence,
    timestamp: `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`,
    timestampSeconds: row.timestamp_seconds,
    content: row.content,
  };
}

// Subscribes to transcript_items for a session: returns the backlog on mount
// plus any inserts that arrive over Supabase Realtime, sorted by sequence.
export function useLiveTranscript(sessionId: string | null) {
  const [items, setItems] = useState<
    (TranscriptItem & {
      id: string;
      sequence: number;
      timestampSeconds: number;
    })[]
  >([]);

  useEffect(() => {
    if (!sessionId) return;
    const supabase = createClient();
    if (!supabase) return;
    let cancelled = false;

    void (async () => {
      const { data } = await supabase
        .from("transcript_items")
        .select("id, sequence, timestamp_seconds, content")
        .eq("session_id", sessionId)
        .order("sequence", { ascending: true });
      if (!cancelled && data) setItems(data.map(rowToItem));
    })();

    // Unique suffix per mount: supabase-js reuses channels by name, so
    // Strict Mode's double-mount would try to .on() an already-subscribed
    // channel. Forcing a fresh name sidesteps that.
    const channel = supabase
      .channel(`transcript:${sessionId}:${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "transcript_items",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          const row = payload.new as DbRow;
          setItems((prev) => {
            if (prev.some((p) => p.id === row.id)) return prev;
            const next = [...prev, rowToItem(row)];
            next.sort((a, b) => a.sequence - b.sequence);
            return next;
          });
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [sessionId]);

  return items;
}
