// Plan 02 rollout step 3: "for every project, config built from the store
// deep-equals config built from the bundle, with identical rule order." This
// is the safety proof gating the flag flip (step 4) — it must stay green.
//
// Runs against the SQLite driver: the compile-from-StoredProject step
// (compileStoredProject, in config-cache.ts) is driver-agnostic — it only
// consumes the StoredProject shape both drivers return identically — so
// proving it here proves it for Postgres too, without needing a live Supabase
// instance to run this in CI.
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { compileMocks } from "../compile/compile";
import type { Rule } from "../compile/schema";
import type { Route } from "../engine/types";
import { compileStoredProject } from "./config-cache";
import { SqliteStore } from "./sqlite";
import type { StoredProject } from "./types";

// Mirrors scripts/sync-cli.ts's conversion exactly — kept separate rather than
// imported, since importing a top-level-await CLI script into a test file
// would run the whole CLI as a side effect.
function routeToRuleDefinition(route: Route): Rule {
  return {
    id: route.id,
    request: {
      method: route.method as Rule["request"]["method"],
      path: route.path,
      ...(route.match ? { match: route.match as Rule["request"]["match"] } : {}),
    },
    response: route.response,
  };
}

describe("store/bundle equivalence (plan 02 step 3)", () => {
  it("compiling a synced project from the store matches compiling it from mocks/ directly", async () => {
    const mocksDir = resolve(__dirname, "..", "..", "mocks");
    const { bundle, errors } = await compileMocks(mocksDir, "test");
    expect(errors).toEqual([]);

    const store = new SqliteStore(":memory:");
    try {
      for (const project of Object.values(bundle.projects)) {
        const stored: StoredProject = {
          slug: project.slug,
          name: project.name,
          basePath: project.basePath,
          defaults: project.defaults,
          openApiDoc: project.openApiDoc,
          source: "repo",
          configVersion: 0,
          updatedAt: new Date(0).toISOString(),
          rules: project.routes.map((route, position) => ({
            ruleId: route.id,
            position,
            definition: routeToRuleDefinition(route),
          })),
        };
        await store.saveProject(stored);

        const roundTripped = await store.getProject(project.slug);
        const fromStore = compileStoredProject(roundTripped!);

        expect(fromStore.routes.map((r) => r.id)).toEqual(project.routes.map((r) => r.id));
        expect(fromStore).toEqual(project);
      }
    } finally {
      await store.close();
    }
  });
});
