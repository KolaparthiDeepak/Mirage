import { afterAll, afterEach, describe, expect, it } from "vitest";
import type { Rule } from "../compile/schema";
import type { Store, StoredProject } from "./types";

function rule(id: string): Rule {
  return { id, request: { method: "GET", path: `/${id}` }, response: { status: 200 } };
}

function project(slug: string, overrides: Partial<StoredProject> = {}): StoredProject {
  return {
    slug,
    name: "Test Project",
    defaults: { delayMs: 0, cors: true, notFound: { status: 404, body: { reason: "UNKNOWN_ROUTE" } } },
    source: "store",
    configVersion: 0, // ignored by saveProject — every driver is server-authoritative on this
    updatedAt: new Date(0).toISOString(),
    rules: [],
    ...overrides,
  };
}

/**
 * The specification for a Store driver (plan 02): a driver that passes this is
 * correct by definition. Both SqliteStore and PostgresStore run this exact
 * suite unmodified — see sqlite.test.ts and postgres.test.ts.
 */
export function runStoreConformanceSuite(label: string, make: () => Store | Promise<Store>): void {
  describe(`Store conformance (${label})`, () => {
    let store: Store | undefined;
    const cleanupSlugs = new Set<string>();

    async function get(): Promise<Store> {
      if (!store) store = await make();
      return store;
    }

    function uniqueSlug(name: string): string {
      const s = `conf-${name}-${Math.random().toString(36).slice(2, 8)}`;
      cleanupSlugs.add(s);
      return s;
    }

    afterEach(async () => {
      const s = await get();
      for (const slug of cleanupSlugs) await s.deleteProject(slug);
      cleanupSlugs.clear();
    });

    afterAll(async () => {
      if (store) await store.close();
    });

    it("round-trips a project with rules", async () => {
      const s = await get();
      const p = project(uniqueSlug("roundtrip"), {
        rules: [
          { ruleId: "a", position: 0, definition: rule("a") },
          { ruleId: "b", position: 1, definition: rule("b") },
        ],
      });
      await s.saveProject(p);
      const back = await s.getProject(p.slug);
      expect(back?.name).toBe(p.name);
      expect(back?.basePath).toBeUndefined();
      expect(back?.defaults).toEqual(p.defaults);
      expect(back?.rules.map((r) => r.ruleId)).toEqual(["a", "b"]);
      expect(back?.rules[0]?.definition).toEqual(p.rules[0]?.definition);
    });

    it("returns null for an unknown project", async () => {
      const s = await get();
      expect(await s.getProject("conf-does-not-exist-xyz")).toBeNull();
    });

    it("orders rules by position, independent of insertion order", async () => {
      const s = await get();
      const slug = uniqueSlug("order");
      await s.saveProject(
        project(slug, {
          rules: [
            { ruleId: "second", position: 1, definition: rule("second") },
            { ruleId: "first", position: 0, definition: rule("first") },
          ],
        }),
      );
      const back = await s.getProject(slug);
      expect(back?.rules.map((r) => r.ruleId)).toEqual(["first", "second"]);
    });

    it("replaces the full rule set on save, rather than merging it", async () => {
      const s = await get();
      const slug = uniqueSlug("replace");
      await s.saveProject(project(slug, { rules: [{ ruleId: "old", position: 0, definition: rule("old") }] }));
      await s.saveProject(project(slug, { rules: [{ ruleId: "new", position: 0, definition: rule("new") }] }));
      const back = await s.getProject(slug);
      expect(back?.rules.map((r) => r.ruleId)).toEqual(["new"]);
    });

    it("bumps config_version monotonically on every save, ignoring the caller's value", async () => {
      const s = await get();
      const slug = uniqueSlug("version");
      await s.saveProject(project(slug, { configVersion: 999 }));
      const v1 = await s.getConfigVersion(slug);
      await s.saveProject(project(slug, { configVersion: 1 }));
      const v2 = await s.getConfigVersion(slug);
      expect(v1).toBe(1);
      expect(v2).toBe(2);
    });

    it("getConfigVersion returns null for an unknown project", async () => {
      const s = await get();
      expect(await s.getConfigVersion("conf-does-not-exist-xyz")).toBeNull();
    });

    it("cascade-deletes rules when a project is deleted", async () => {
      const s = await get();
      const slug = uniqueSlug("cascade");
      cleanupSlugs.delete(slug); // deleted below; nothing left for afterEach to do
      await s.saveProject(project(slug, { rules: [{ ruleId: "r", position: 0, definition: rule("r") }] }));
      await s.deleteProject(slug);
      expect(await s.getProject(slug)).toBeNull();
    });

    it("lists projects with an accurate rule count", async () => {
      const s = await get();
      const slug = uniqueSlug("list");
      await s.saveProject(
        project(slug, {
          rules: [
            { ruleId: "r1", position: 0, definition: rule("r1") },
            { ruleId: "r2", position: 1, definition: rule("r2") },
          ],
        }),
      );
      const list = await s.listProjects();
      expect(list.find((p) => p.slug === slug)?.ruleCount).toBe(2);
    });

    it("round-trips an openApiDoc and a basePath", async () => {
      const s = await get();
      const slug = uniqueSlug("openapi");
      await s.saveProject(project(slug, { basePath: "/commands", openApiDoc: { openapi: "3.0.0", paths: {} } }));
      const back = await s.getProject(slug);
      expect(back?.basePath).toBe("/commands");
      expect(back?.openApiDoc).toEqual({ openapi: "3.0.0", paths: {} });
    });
  });
}
