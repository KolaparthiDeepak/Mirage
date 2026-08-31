import { describe, it, expect } from "vitest";
import type { ProjectVM } from "@/src/viewer/model";
import { sampleTraffic } from "./sample-traffic";

const draft = { method: "GET", url: "", headers: {}, curl: "", notes: [] };

function mkEndpoint(n: number) {
  return {
    key: `EP_${n}`,
    method: n % 2 === 0 ? "GET" : "POST",
    path: `/x/EP_${n}/v1`,
    runUrl: "",
    cases: [
      {
        id: `c${n}a`,
        label: "",
        isOpenApiGenerated: false,
        match: [],
        expected: { status: 200, body: { ok: true, n } },
        request: { ...draft, body: `{"n":${n}}` },
      },
      {
        id: `c${n}b`,
        label: "",
        isOpenApiGenerated: false,
        match: [],
        expected: { status: 404 },
        request: draft,
      },
    ],
  };
}

// 20 endpoints -> more than the old cap of 12, still under the new cap of 30.
const project = {
  slug: "p",
  name: "P",
  endpoints: Array.from({ length: 20 }, (_, i) => mkEndpoint(i)),
  caseCount: 40,
} as unknown as ProjectVM;

describe("sampleTraffic", () => {
  const keys = project.endpoints.map((e) => e.key);

  it("only references real endpoint keys", () => {
    const entries = sampleTraffic(project);
    expect(entries.length).toBeGreaterThan(0);
    for (const e of entries) expect(keys).toContain(e.endpointKey);
  });

  it("gives every entry a real numeric status", () => {
    for (const e of sampleTraffic(project)) {
      expect(typeof e.status).toBe("number");
      expect(Number.isFinite(e.status)).toBe(true);
    }
  });

  it("is deterministic across calls", () => {
    expect(sampleTraffic(project)).toEqual(sampleTraffic(project));
  });

  it("returns more than 12 and at most 30 entries", () => {
    const n = sampleTraffic(project).length;
    expect(n).toBeGreaterThan(12);
    expect(n).toBeLessThanOrEqual(30);
  });

  it("carries a JSON content-type header and string bodies", () => {
    for (const e of sampleTraffic(project)) {
      expect(e.reqHeaders["content-type"]).toBe("application/json");
      expect(typeof e.reqBody).toBe("string");
      expect(typeof e.resBody).toBe("string");
    }
  });
});
