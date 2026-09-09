import { PostgresStore } from "./postgres";
import { SqliteStore } from "./sqlite";
import type { Store } from "./types";

export type { Store, StoredProject, StoredProjectMeta, StoredRule, ProjectSummary } from "./types";

/**
 * Driver selection (plan 02, "in local, local store; in prod, Supabase"):
 * no DATABASE_URL -> local SQLite, zero setup. DATABASE_URL set -> Postgres
 * (Supabase in production). MIRAGE_DB_DRIVER overrides either explicitly, for
 * tests and for anyone who wants Postgres locally too.
 */
export function createStore(): Store {
  const driver = process.env.MIRAGE_DB_DRIVER ?? (process.env.DATABASE_URL ? "postgres" : "sqlite");
  if (driver === "postgres") {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("MIRAGE_DB_DRIVER=postgres requires DATABASE_URL");
    return new PostgresStore(url);
  }
  return new SqliteStore(process.env.MIRAGE_DB_PATH ?? ".data/mirage.db");
}
