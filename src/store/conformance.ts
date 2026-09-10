import { randomUUID } from "node:crypto";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import type { Rule } from "../compile/schema";
import type { Store, StoredProject, TrafficEntry } from "./types";

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

    it("round-trips the upstream config (plan 07), and undefined when unset", async () => {
      const s = await get();
      const withUpstream = uniqueSlug("upstream-on");
      await s.saveProject(
        project(withUpstream, {
          upstream: { url: "https://api.example.com", mode: "record", forwardAuth: false, timeoutMs: 5000 },
        }),
      );
      expect((await s.getProject(withUpstream))?.upstream).toEqual({
        url: "https://api.example.com",
        mode: "record",
        forwardAuth: false,
        timeoutMs: 5000,
      });

      const without = uniqueSlug("upstream-off");
      await s.saveProject(project(without));
      expect((await s.getProject(without))?.upstream).toBeUndefined();
    });

    it("round-trips the faults config (plan 11)", async () => {
      const s = await get();
      const slug = uniqueSlug("faults");
      const faults = {
        enabled: true,
        latency: { mode: "jitter" as const, baseMs: 50, jitterMs: 20 },
        errorRate: { percent: 5, status: 503 },
        seed: "release-42",
      };
      await s.saveProject(project(slug, { faults }));
      expect((await s.getProject(slug))?.faults).toEqual(faults);
    });

    it("round-trips variables and the default environment (plan 17)", async () => {
      const s = await get();
      const slug = uniqueSlug("vars");
      const variables = [
        { key: "merchantName", value: "Acme", scope: "project" as const },
        { key: "riskScore", value: 12, scope: "project" as const, overrides: { staging: 85 } },
      ];
      await s.saveProject(project(slug, { variables, defaultEnvironment: "prod" }));
      const back = await s.getProject(slug);
      expect(back?.variables).toEqual(variables);
      expect(back?.defaultEnvironment).toBe("prod");
    });

    it("round-trips the contract config (plan 13)", async () => {
      const s = await get();
      const slug = uniqueSlug("contract");
      const contract = { validate: true, enforce: true, rejectInvalid: false };
      await s.saveProject(project(slug, { contract }));
      expect((await s.getProject(slug))?.contract).toEqual(contract);
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

    // --- plan 04: traffic recording ---
    // Traffic rows have no scoped bulk-delete in the Store interface (matching
    // the real design — see plan 04), so these tests don't clean up after
    // themselves the way project tests do. Harmless against the in-memory
    // SQLite instance (thrown away in afterAll) and against a disposable
    // Postgres schema, which is what postgres.test.ts documents as required.

    it("records and queries a traffic entry, newest first", async () => {
      const s = await get();
      const slug = uniqueSlug("traffic-basic");
      const e1 = trafficEntry(slug, { at: "2026-01-01T00:00:00.000Z", matchedRuleId: "r1" });
      const e2 = trafficEntry(slug, { at: "2026-01-01T00:00:01.000Z", matchedRuleId: "r2" });
      await s.recordTraffic(e1);
      await s.recordTraffic(e2);

      const rows = await s.queryTraffic({ slug });
      expect(rows.map((r) => r.id)).toEqual([e2.id, e1.id]);
      expect(rows[0]).toEqual(e2);
    });

    it("queryTraffic respects limit", async () => {
      const s = await get();
      const slug = uniqueSlug("traffic-limit");
      for (let i = 0; i < 5; i++) {
        await s.recordTraffic(trafficEntry(slug, { at: `2026-02-01T00:00:0${i}.000Z` }));
      }
      const rows = await s.queryTraffic({ slug, limit: 2 });
      expect(rows).toHaveLength(2);
    });

    it("queryTraffic pages with `before`", async () => {
      const s = await get();
      const slug = uniqueSlug("traffic-before");
      await s.recordTraffic(trafficEntry(slug, { at: "2026-03-01T00:00:00.000Z" }));
      const middle = trafficEntry(slug, { at: "2026-03-01T00:00:01.000Z" });
      await s.recordTraffic(middle);
      await s.recordTraffic(trafficEntry(slug, { at: "2026-03-01T00:00:02.000Z" }));

      const page = await s.queryTraffic({ slug, before: "2026-03-01T00:00:02.000Z" });
      expect(page[0]?.id).toBe(middle.id);
    });

    it("queryTraffic filters to unmatched-only", async () => {
      const s = await get();
      const slug = uniqueSlug("traffic-unmatched");
      await s.recordTraffic(trafficEntry(slug, { matchedRuleId: "r1" }));
      const unmatched = trafficEntry(slug, { matchedRuleId: null });
      await s.recordTraffic(unmatched);

      const rows = await s.queryTraffic({ slug, unmatchedOnly: true });
      expect(rows.map((r) => r.id)).toEqual([unmatched.id]);
    });

    it("queryTraffic fetches one row by id", async () => {
      const s = await get();
      const slug = uniqueSlug("traffic-by-id");
      await s.recordTraffic(trafficEntry(slug));
      const target = trafficEntry(slug);
      await s.recordTraffic(target);
      const rows = await s.queryTraffic({ slug, id: target.id });
      expect(rows.map((r) => r.id)).toEqual([target.id]);
    });

    it("queryTraffic filters by method, ruleId, pathContains and status range", async () => {
      const s = await get();
      const slug = uniqueSlug("traffic-filters");
      const target = trafficEntry(slug, { method: "POST", path: "/orders/create", matchedRuleId: "create-order", status: 201 });
      await s.recordTraffic(target);
      await s.recordTraffic(trafficEntry(slug, { method: "GET", path: "/orders/list", matchedRuleId: "list-orders", status: 200 }));
      await s.recordTraffic(trafficEntry(slug, { method: "POST", path: "/orders/create", matchedRuleId: "create-order", status: 500 }));

      expect((await s.queryTraffic({ slug, method: "POST" })).length).toBe(2);
      expect((await s.queryTraffic({ slug, ruleId: "list-orders" })).map((r) => r.id)).toEqual([expect.any(String)]);
      expect((await s.queryTraffic({ slug, pathContains: "create" })).length).toBe(2);
      expect((await s.queryTraffic({ slug, statusFrom: 500, statusTo: 599 })).length).toBe(1);
      expect((await s.queryTraffic({ slug, method: "POST", pathContains: "create", statusFrom: 200, statusTo: 299 })).map((r) => r.id)).toEqual([
        target.id,
      ]);
    });

    it("queryTraffic with `since` returns only newer rows, oldest first", async () => {
      const s = await get();
      const slug = uniqueSlug("traffic-since");
      await s.recordTraffic(trafficEntry(slug, { at: "2026-05-01T00:00:00.000Z" }));
      const b = trafficEntry(slug, { at: "2026-05-01T00:00:01.000Z" });
      const c = trafficEntry(slug, { at: "2026-05-01T00:00:02.000Z" });
      await s.recordTraffic(b);
      await s.recordTraffic(c);

      const rows = await s.queryTraffic({ slug, since: "2026-05-01T00:00:00.500Z" });
      expect(rows.map((r) => r.id)).toEqual([b.id, c.id]); // oldest first, unlike the default newest-first order
    });

    it("filters to viaUpstream rows for the Recordings view (plan 07)", async () => {
      const s = await get();
      const slug = uniqueSlug("traffic-via-upstream");
      const mocked = trafficEntry(slug, { at: "2026-06-01T00:00:00.000Z" });
      const proxied = trafficEntry(slug, { at: "2026-06-01T00:00:01.000Z", matchedRuleId: null, viaUpstream: true });
      await s.recordTraffic(mocked);
      await s.recordTraffic(proxied);

      const rows = await s.queryTraffic({ slug, viaUpstreamOnly: true });
      expect(rows.map((r) => r.id)).toEqual([proxied.id]);
    });

    it("round-trips redacted-looking bodies, query params and warnings untouched", async () => {
      const s = await get();
      const slug = uniqueSlug("traffic-shape");
      const e = trafficEntry(slug, {
        query: { page: "2" },
        reqHeaders: { authorization: "***" },
        reqBody: JSON.stringify({ card: { number: "***" } }),
        warnings: ["template value not found: {{x}}"],
        truncated: true,
      });
      await s.recordTraffic(e);
      const [back] = await s.queryTraffic({ slug });
      expect(back).toEqual(e);
    });

    it("pruneTraffic deletes rows older than the cutoff and keeps newer ones", async () => {
      const s = await get();
      const slug = uniqueSlug("traffic-prune-age");
      const old = trafficEntry(slug, { at: "2020-01-01T00:00:00.000Z" });
      const recent = trafficEntry(slug, { at: new Date().toISOString() });
      await s.recordTraffic(old);
      await s.recordTraffic(recent);

      const deleted = await s.pruneTraffic(new Date("2021-01-01"), 1_000_000);
      expect(deleted).toBeGreaterThanOrEqual(1);
      const remaining = await s.queryTraffic({ slug });
      expect(remaining.map((r) => r.id)).toEqual([recent.id]);
    });

    it("bumpCounter increments atomically per (slug, rule, session), returning the new value", async () => {
      const s = await get();
      const slug = uniqueSlug("counter");
      expect(await s.bumpCounter(slug, "r", "sess")).toBe(1);
      expect(await s.bumpCounter(slug, "r", "sess")).toBe(2);
      expect(await s.bumpCounter(slug, "r", "other")).toBe(1); // separate session
      expect(await s.bumpCounter(slug, "r2", "sess")).toBe(1); // separate rule
    });

    it("concurrent bumpCounter calls produce no duplicate values", async () => {
      const s = await get();
      const slug = uniqueSlug("counter-race");
      const results = await Promise.all(Array.from({ length: 20 }, () => s.bumpCounter(slug, "r", "sess")));
      expect([...results].sort((a, b) => a - b)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
    });

    it("resetCounters honours its scope", async () => {
      const s = await get();
      const slug = uniqueSlug("counter-reset");
      await s.bumpCounter(slug, "r1", "a");
      await s.bumpCounter(slug, "r1", "b");
      await s.bumpCounter(slug, "r2", "a");

      expect(await s.resetCounters(slug, "r1", "a")).toBe(1); // one session
      expect(await s.bumpCounter(slug, "r1", "a")).toBe(1); // back to 1
      expect(await s.bumpCounter(slug, "r1", "b")).toBe(2); // untouched

      expect(await s.resetCounters(slug)).toBeGreaterThanOrEqual(2); // whole project
    });

    it("pruneCounters deletes counters idle before the cutoff", async () => {
      const s = await get();
      const slug = uniqueSlug("counter-prune");
      await s.bumpCounter(slug, "r", "sess");
      expect(await s.pruneCounters(new Date(Date.now() + 60_000))).toBeGreaterThanOrEqual(1);
      expect(await s.bumpCounter(slug, "r", "sess")).toBe(1); // was swept, restarts
    });

    it("pruneTraffic caps rows per project, keeping the newest", async () => {
      const s = await get();
      const slug = uniqueSlug("traffic-prune-count");
      const entries: TrafficEntry[] = [];
      for (let i = 0; i < 5; i++) {
        const e = trafficEntry(slug, { at: `2026-04-01T00:00:0${i}.000Z` });
        entries.push(e);
        await s.recordTraffic(e);
      }

      await s.pruneTraffic(new Date(0), 2); // age cutoff far in the past — only the count cap should bite
      const remaining = await s.queryTraffic({ slug, limit: 10 });
      expect(remaining.map((r) => r.id)).toEqual([entries[4]!.id, entries[3]!.id]);
    });
  });
}

function trafficEntry(slug: string, overrides: Partial<TrafficEntry> = {}): TrafficEntry {
  return {
    id: randomUUID(),
    slug,
    at: new Date().toISOString(),
    method: "GET",
    path: "/x",
    query: {},
    reqHeaders: {},
    reqBody: null,
    status: 200,
    resHeaders: {},
    resBody: null,
    matchedRuleId: "some-rule",
    durationMs: 5,
    warnings: [],
    clientHash: null,
    configVersion: 1,
    truncated: false,
    viaUpstream: false,
    direction: "inbound",
    ...overrides,
  };
}
