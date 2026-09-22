// Plan 02 rollout step 2: mirrors mocks/** into the store as source: "repo"
// projects, so the store can serve exactly what the file workflow already
// produces — no UI write path exists for these projects (plan 02: "one
// writer per project, no merge problem to solve").
//
// Deliberately reuses compileMocks() rather than re-parsing YAML: the
// compiled Route already carries exactly what a stored rule needs (id,
// method, path, match, response) with the same validation compile-cli.ts
// already enforces. A route's `method` can never actually be "OPTIONS" here —
// ruleSchema forbids it (B9) and OpenAPI expansion never emits it — so the
// narrowing cast below is safe, not just convenient.
import { resolve } from "node:path";
import type { Rule } from "../src/compile/schema";
import { compileMocks } from "../src/compile/compile";
import { gitCommit } from "../src/compile/git-commit";
import { createStore } from "../src/store";
import type { StoredProject } from "../src/store/types";
import type { Route } from "../src/engine/types";

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

async function main(): Promise<void> {
  const mocksDir = resolve(process.cwd(), "mocks");
  const { bundle, errors, warnings } = await compileMocks(mocksDir, gitCommit());

  for (const w of warnings) console.warn(`[sync] WARN ${w}`);
  if (errors.length > 0) {
    for (const e of errors) console.error(`[sync] ERROR ${e}`);
    console.error(`[sync] ${errors.length} error(s) — aborting sync, store left untouched`);
    process.exit(1);
  }

  const store = createStore();
  try {
    const projects = Object.values(bundle.projects);
    for (const project of projects) {
      const stored: StoredProject = {
        slug: project.slug,
        name: project.name,
        basePath: project.basePath,
        defaults: project.defaults,
        openApiDoc: project.openApiDoc,
        source: "repo",
        configVersion: 0, // ignored by saveProject — every driver is server-authoritative on this
        updatedAt: new Date(0).toISOString(), // ditto
        rules: project.routes.map((route, position) => ({
          ruleId: route.id,
          position,
          definition: routeToRuleDefinition(route),
        })),
      };
      await store.saveProject(stored);
      console.log(`[sync] synced "${project.slug}" — ${stored.rules.length} rule(s)`);
    }
    console.log(`[sync] done — ${projects.length} project(s) mirrored from mocks/`);
  } finally {
    await store.close();
  }
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
