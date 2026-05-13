import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";

// Anon-key Supabase client bound to the current request's cookies. Use for
// queries that should respect RLS as the signed-in user.
//
// Returns null when the Supabase env vars are missing so server components
// can degrade gracefully (the auth gate will redirect to /login). This keeps
// `next build` from crashing during prerender when env is incomplete.
export async function createClient(): Promise<SupabaseClient | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  const cookieStore = await cookies();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(
        cookiesToSet: {
          name: string;
          value: string;
          options: CookieOptions;
        }[],
      ) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // setAll from a Server Component is a no-op; refresh happens on
          // the next server action / route handler that has cookie-write
          // access.
        }
      },
    },
  });
}
