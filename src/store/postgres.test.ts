import { describe, it } from "vitest";
import { PostgresStore } from "./postgres";
import { runStoreConformanceSuite } from "./conformance";

// No live Supabase project exists yet. Set DATABASE_URL to a real (ideally
// disposable/test-schema) Postgres connection string to run this for real —
// same suite as sqlite.test.ts, so a bug that only reproduces against Postgres
// is caught here rather than after a deploy.
const url = process.env.DATABASE_URL;

if (url) {
  runStoreConformanceSuite("postgres", () => new PostgresStore(url));
} else {
  describe("Store conformance (postgres)", () => {
    it.skip("set DATABASE_URL to run this against a real Postgres/Supabase instance", () => {});
  });
}
