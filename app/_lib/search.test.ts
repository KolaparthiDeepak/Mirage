import { describe, it, expect } from "vitest";
import { searchViewModel } from "./search";
import type { ViewModel, ProjectVM, CaseVM } from "@/src/viewer/model";

// Fixture ViewModel
const caseBase: Omit<CaseVM, "id" | "label"> = {
  isOpenApiGenerated: false,
  match: [],
  expected: { status: 200 },
  request: { method: "POST", url: "", headers: {}, body: "", curl: "", notes: [] },
};

const project1: ProjectVM = {
  slug: "card-block-lost",
  name: "Card Block",
  endpoints: [
    {
      key: "POST /acropolis-card-mgmt/GET_CARD/v1",
      method: "POST",
      path: "/acropolis-card-mgmt/GET_CARD/v1",
      runUrl: "/m/card-block-lost/acropolis-card-mgmt/GET_CARD/v1",
      summary: "Retrieve card status",
      cases: Array.from({ length: 12 }, (_, i) => ({
        ...caseBase,
        id: `locate-${i}`,
        label: `locate card ${i}`,
      })),
    },
  ],
  caseCount: 12,
};

const project2: ProjectVM = {
  slug: "payments",
  name: "Payments",
  endpoints: [
    {
      key: "GET /payments/list",
      method: "GET",
      path: "/payments/list",
      runUrl: "/m/payments/payments/list",
      cases: [
        { ...caseBase, id: "pay-1", label: "list payments" },
      ],
    },
  ],
  caseCount: 1,
};

const model: ViewModel = {
  build: { commit: "abc", builtAt: "2026-08-30", warnings: [] },
  projects: [project1, project2],
};

describe("searchViewModel", () => {
  it("returns empty arrays for empty query", () => {
    const result = searchViewModel(model, "");
    expect(result.projects).toEqual([]);
    expect(result.endpoints).toEqual([]);
    expect(result.cases).toEqual([]);
  });

  it("returns empty arrays for whitespace query", () => {
    const result = searchViewModel(model, "   ");
    expect(result.projects).toEqual([]);
    expect(result.endpoints).toEqual([]);
    expect(result.cases).toEqual([]);
  });

  it("matches projects by name (case-insensitive)", () => {
    const result = searchViewModel(model, "card");
    expect(result.projects.length).toBe(1);
    expect(result.projects[0]!.slug).toBe("card-block-lost");
  });

  it("matches projects by slug (case-insensitive)", () => {
    const result = searchViewModel(model, "CARD-BLOCK");
    expect(result.projects.length).toBe(1);
    expect(result.projects[0]!.slug).toBe("card-block-lost");
  });

  it("matches endpoints by commandCode (case-insensitive)", () => {
    const result = searchViewModel(model, "get_card");
    expect(result.endpoints.length).toBe(1);
    expect(result.endpoints[0]!.endpoint.path).toBe("/acropolis-card-mgmt/GET_CARD/v1");
  });

  it("matches endpoints by path (case-insensitive)", () => {
    const result = searchViewModel(model, "ACROPOLIS");
    expect(result.endpoints.length).toBe(1);
    expect(result.endpoints[0]!.endpoint.path).toBe("/acropolis-card-mgmt/GET_CARD/v1");
  });

  it("matches endpoints by method (case-insensitive)", () => {
    const result = searchViewModel(model, "post");
    expect(result.endpoints.length).toBe(1);
    expect(result.endpoints[0]!.endpoint.method).toBe("POST");
  });

  it("matches endpoints by summary (case-insensitive)", () => {
    const result = searchViewModel(model, "retrieve");
    expect(result.endpoints.length).toBe(1);
    expect(result.endpoints[0]!.endpoint.summary).toBe("Retrieve card status");
  });

  it("matches cases by label (case-insensitive)", () => {
    const result = searchViewModel(model, "locate");
    expect(result.cases.length).toBe(8); // Capped at 8
    expect(result.cases.every((c) => c.case.label.includes("locate"))).toBe(true);
  });

  it("caps cases at 8 when more than 8 match", () => {
    const result = searchViewModel(model, "locate");
    expect(result.cases.length).toBe(8);
  });

  it("matches cases by id", () => {
    const result = searchViewModel(model, "locate-3");
    expect(result.cases.length).toBe(1);
    expect(result.cases[0]!.case.id).toBe("locate-3");
  });

  it("caps projects at 8", () => {
    const manyProjects: ViewModel = {
      build: model.build,
      projects: Array.from({ length: 15 }, (_, i) => ({
        slug: `proj-${i}`,
        name: `Project ${i}`,
        endpoints: [],
        caseCount: 0,
      })),
    };
    const result = searchViewModel(manyProjects, "project");
    expect(result.projects.length).toBe(8);
  });

  it("caps endpoints at 8", () => {
    const manyEndpoints: ViewModel = {
      build: model.build,
      projects: [
        {
          slug: "many",
          name: "Many",
          endpoints: Array.from({ length: 15 }, (_, i) => ({
            key: `GET /test-${i}`,
            method: "GET",
            path: `/test-${i}`,
            runUrl: `/m/many/test-${i}`,
            cases: [],
          })),
          caseCount: 0,
        },
      ],
    };
    const result = searchViewModel(manyEndpoints, "test");
    expect(result.endpoints.length).toBe(8);
  });

  it("includes parent references in results", () => {
    const result = searchViewModel(model, "locate");
    const first = result.cases[0];
    expect(first!.project.slug).toBe("card-block-lost");
    expect(first!.endpoint.path).toBe("/acropolis-card-mgmt/GET_CARD/v1");
    expect(first!.case.id).toBe("locate-0");
  });
});
