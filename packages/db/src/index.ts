import { drizzle } from "drizzle-orm/postgres-js";
import postgres, { type Options } from "postgres";
import * as schema from "./schema.ts";

export * from "./schema.ts";

export type Database = ReturnType<typeof createDb>;

export function createDb(
  databaseUrl: string,
  options?: Options<Record<string, never>>,
): ReturnType<typeof drizzle<typeof schema>> {
  const client = postgres(databaseUrl, options);
  return drizzle(client, { schema });
}
