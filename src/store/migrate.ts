import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

export interface Migration {
  /** Filename with the dialect suffix stripped, e.g. "001-init". Sorted
   *  lexically, so pad the numeric prefix (001, 002, ...) to keep order stable
   *  past migration 9. */
  id: string;
  sql: string;
}

const MIGRATIONS_DIR = join(__dirname, "migrations");

/** Reads every "<id>.<dialect>.sql" file for the given dialect, in filename
 *  order. Loading is shared; *applying* them is not — better-sqlite3 is
 *  synchronous and postgres.js is promise-based, and unifying two call sites
 *  behind a generic runner would be more code than the two drivers' own
 *  apply loops (see sqlite.ts and postgres.ts). */
export function loadMigrations(dialect: "postgres" | "sqlite"): Migration[] {
  const suffix = `.${dialect}.sql`;
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(suffix))
    .sort()
    .map((f) => ({ id: f.slice(0, -suffix.length), sql: readFileSync(join(MIGRATIONS_DIR, f), "utf8") }));
}
