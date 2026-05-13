"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

// Memoize the browser client across renders/hooks. supabase-js keeps a
// channels registry keyed by name, so creating a new client per hook makes
// re-subscribe behaviour under React Strict Mode unpredictable. One client
// per tab is the supported pattern.
let cached: SupabaseClient | null = null;

export function createClient(): SupabaseClient | null {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    if (typeof window !== "undefined") {
      console.warn(
        "[supabase] NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY missing — realtime disabled",
      );
    }
    return null;
  }
  cached = createBrowserClient(url, key);
  return cached;
}
