import { describe, it, expect } from "vitest";
import type { ProjectVM } from "@/src/viewer/model";
import { sampleTraffic } from "./sample-traffic";

const draft = { method: "GET", url: "", headers: {}, curl: "", notes: [] };

const project = {
  slug: "p",
  name: "P",
  endpoints: [
    {
      key: "GET_CARD",
      method: "GET",
      path: "/x/GET_CARD/v1",
      runUrl: "",
      cases: [
        {
          id: "c1",
          label: "",
          isOpenApiGenerated: false,
          match: [],
          expected: { status: 200, body: { ok: true } },
          request: draft,
        },
        {
          id: "c2",
          label: "",
          isOpenApiGenerated: false,
          match: [],
          expected: { status: 404 },
          request: draft,
        },
      ],
    },
    {
      key: "POST_CARD",
      method: "POST",
      path: "/x/POST_CARD/v1",
      runUrl: "",
      cases: [
        {
          id: "c3",
          label: "",
          isOpenApiGenerated: false,
          match: [],
          expected: { status: 201 },
          request: draft,
        },
      ],
    },
  ],
  caseCount: 3,
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

  it("caps at ~12 entries", () => {
    expect(sampleTraffic(project).length).toBeLessThanOrEqual(12);
  });
});
