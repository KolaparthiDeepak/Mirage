import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// This package is "type": "module" — __dirname doesn't exist in ESM scope.
const __dirname = dirname(fileURLToPath(import.meta.url));

export interface Migration {
  /** Filename with the dialect suffix stripped, e.g. "001-init". */
  id: string;
  sql: string;
}

const MIGRATIONS_DIR = join(__dirname, "migrations");

// Real bug, caught on the first real Vercel deploy: this used to be
// readdirSync(MIGRATIONS_DIR) — a runtime directory scan. Next.js's file
// tracer (@vercel/nft) statically analyzes fs.readFileSync call sites with a
// resolvable literal path to decide which files a deployed serverless
// function needs; it has no way to know what a readdirSync() will enumerate
// at runtime, so none of the migration .sql files were ever actually
// included in the deployed bundle — every write against a real Postgres
// database failed with "ENOENT: ... scandir '.../migrations'", logged and
// swallowed (plan 04's "never fail the response" rule), so it was silent
// until someone went looking for why traffic wasn't being recorded.
//
// Fixed by making this an explicit, static, in-order list instead — plan
// 02's own "one migration per plan, forward-only, additive" rule already
// makes this a small, append-only list. Add the next id here when you add a
// migration; nothing else changes.
const MIGRATION_IDS = [
  "001-init",
  "002-traffic",
  "003-upstream",
  "004-counter",
  "005-faults",
  "006-callback-direction",
  "007-variables",
  "008-contract",
  "009-config-event",
  "010-flows",
  "011-docs",
  "012-views-and-alerts",
  "013-drift",
] as const;

/** Reads every migration's "<id>.<dialect>.sql" file, in the order declared
 *  above. Loading is shared; *applying* them is not — better-sqlite3 is
 *  synchronous and postgres.js is promise-based, and unifying two call sites
 *  behind a generic runner would be more code than the two drivers' own
 *  apply loops (see sqlite.ts and postgres.ts). */
export function loadMigrations(dialect: "postgres" | "sqlite"): Migration[] {
  return MIGRATION_IDS.map((id) => ({
    id,
    sql: readFileSync(join(MIGRATIONS_DIR, `${id}.${dialect}.sql`), "utf8"),
  }));
}
