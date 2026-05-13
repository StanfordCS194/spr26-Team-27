import "server-only";

import { createDb, type Database } from "@spr26/db";

// Memoize the Drizzle client at module scope so warm Vercel invocations
// reuse the same postgres-js pool. Cold starts allocate one.
//
// DATABASE_URL should point at Supabase's **transaction pooler** (port 6543)
// for serverless workloads — short-lived, doesn't keep a session pinned.
// Prepared statements are off because PgBouncer in transaction mode rejects
// them.
let cached: Database | null = null;

export function db(): Database {
  if (cached) return cached;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  cached = createDb(url, {
    prepare: false,
    max: 1,
    idle_timeout: 20,
  });
  return cached;
}
