import { MIGRATIONS } from "./migrations-manifest";

export interface Migration {
  /** Filename with the dialect suffix stripped, e.g. "001-init". */
  id: string;
  sql: string;
}

// Real bug, caught on the first real Vercel deploy — twice, in two different
// shapes. First: this used to be readdirSync(MIGRATIONS_DIR), a runtime
// directory scan. Next.js's file tracer (@vercel/nft) statically analyzes
// fs.readFileSync call sites with a resolvable literal path to decide which
// files a deployed serverless function needs; it can't know what a
// readdirSync() will enumerate at runtime, so no migration .sql file ever
// reached the deployed bundle. Second attempt: switching to readFileSync()
// with a path built from a static array + template literal *still* wasn't
// traceable — the tracer didn't resolve the templated filename either.
//
// Both failures logged and swallowed per plan 04's "never fail the
// response" rule, so both were silent until someone went looking at why
// traffic wasn't being recorded against the real database.
//
// The fix that actually works: migrations-manifest.ts embeds every
// migration's SQL as a literal string constant in a real TS module (see
// scripts/generate-migrations-manifest.ts, run via `npm run
// generate-migrations` — wired into predev/prebuild/postinstall so it can't
// go stale). That sidesteps file tracing entirely: it's ordinary application
// code, bundled the same way any other import is, nothing to trace.
export function loadMigrations(dialect: "postgres" | "sqlite"): Migration[] {
  return MIGRATIONS.map((m) => ({ id: m.id, sql: m[dialect] }));
}
