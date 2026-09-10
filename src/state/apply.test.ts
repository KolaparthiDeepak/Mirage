import { describe, it, expect, vi } from "vitest";
import type { ResolveResult, ResponseVariants } from "../engine/types";
import type { Store } from "../store/types";
import { applyState, pickVariantIndex, sessionKey } from "./apply";

function counterStore(): Store {
  const counters = new Map<string, number>();
  return {
    async bumpCounter(slug: string, ruleId: string, session: string) {
      const k = `${slug}|${ruleId}|${session}`;
      const n = (counters.get(k) ?? 0) + 1;
      counters.set(k, n);
      return n;
    },
    async resetCounters(slug: string, ruleId?: string, session?: string) {
      let removed = 0;
      for (const k of [...counters.keys()]) {
        const [s, r, sess] = k.split("|");
        if (s === slug && (ruleId == null || r === ruleId) && (session == null || sess === session)) {
          counters.delete(k);
          removed++;
        }
      }
      return removed;
    },
    async pruneCounters() {
      return 0;
    },
  } as unknown as Store;
}

function result(responses: ResponseVariants, headers: Record<string, string> = {}): ResolveResult {
  return {
    status: responses.variants[0]!.status,
    headers: {},
    body: responses.variants[0]!.body ?? null,
    matchedRuleId: "r",
    delayMs: 0,
    warnings: [],
    matchedRoute: { id: "r", method: "GET", path: "/r", segments: [], response: responses.variants[0]!, responses },
    templateContext: { body: undefined, path: {}, query: {}, header: headers },
  };
}

const seq: ResponseVariants = {
  strategy: "sequence",
  repeatLast: true,
  variants: [{ status: 503 }, { status: 503 }, { status: 201, body: { ok: true } }],
};

describe("pickVariantIndex", () => {
  it("sequence: Nth call gets Nth variant, then repeats the last", () => {
    expect([0, 1, 2, 3, 4].map((n) => pickVariantIndex(seq, n, "default"))).toEqual([0, 1, 2, 2, 2]);
  });
  it("sequence with repeatLast false cycles", () => {
    const cyc = { ...seq, repeatLast: false };
    expect([0, 1, 2, 3, 4].map((n) => pickVariantIndex(cyc, n, "default"))).toEqual([0, 1, 2, 0, 1]);
  });
  it("conditional: first variant whose callCount `when` passes", () => {
    const cond: ResponseVariants = {
      strategy: "conditional",
      repeatLast: true,
      variants: [
        { status: 429, when: { callCount: { lt: 2 } } },
        { status: 200, when: { callCount: { gte: 2 } } },
      ],
    };
    expect([0, 1, 2, 3].map((n) => pickVariantIndex(cond, n, "default"))).toEqual([0, 0, 1, 1]);
  });
  it("weighted: deterministic for a fixed session + counter", () => {
    const w: ResponseVariants = {
      strategy: "weighted",
      repeatLast: true,
      variants: [{ status: 200, weight: 1 }, { status: 500, weight: 1 }],
    };
    const a = [0, 1, 2, 3, 4].map((n) => pickVariantIndex(w, n, "sess-1"));
    const b = [0, 1, 2, 3, 4].map((n) => pickVariantIndex(w, n, "sess-1"));
    expect(a).toEqual(b);
    expect(pickVariantIndex(w, 0, "sess-2")).toBe(pickVariantIndex(w, 0, "sess-2"));
  });
});

describe("applyState", () => {
  it("advances the sequence per call and bumps the counter", async () => {
    const store = counterStore();
    const statuses: number[] = [];
    for (let i = 0; i < 4; i++) {
      const out = await applyState(store, "p", result(seq));
      statuses.push(out!.status);
    }
    expect(statuses).toEqual([503, 503, 201, 201]);
  });

  it("two sessions advance independently", async () => {
    const store = counterStore();
    const a = await applyState(store, "p", result(seq, { "x-mirage-session": "alice" }));
    const b1 = await applyState(store, "p", result(seq, { "x-mirage-session": "bob" }));
    const b2 = await applyState(store, "p", result(seq, { "x-mirage-session": "bob" }));
    expect(a!.variantIndex).toBe(0);
    expect(b1!.variantIndex).toBe(0);
    expect(b2!.variantIndex).toBe(1);
  });

  it("returns null for a non-variant rule", async () => {
    const store = counterStore();
    const r = result(seq);
    r.matchedRoute!.responses = undefined;
    expect(await applyState(store, "p", r)).toBeNull();
  });

  it("falls back (returns null) and logs when the counter store is unavailable", async () => {
    const store = { bumpCounter: vi.fn().mockRejectedValue(new Error("down")) } as unknown as Store;
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await applyState(store, "p", result(seq))).toBeNull();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe("sessionKey", () => {
  it("uses the configured header, falling back to 'default'", () => {
    expect(sessionKey({ "x-mirage-session": "s1" }, seq)).toBe("s1");
    expect(sessionKey({}, seq)).toBe("default");
    expect(sessionKey({ "x-env": "qa" }, { ...seq, sessionHeader: "X-Env" })).toBe("qa");
  });
});
