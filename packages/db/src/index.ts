import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.ts";

export * from "./schema.ts";

export type Database = ReturnType<typeof createDb>;

export function createDb(
  databaseUrl: string,
): ReturnType<typeof drizzle<typeof schema>> {
  const client = postgres(databaseUrl);
  return drizzle(client, { schema });
}
