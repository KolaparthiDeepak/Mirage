import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ToastProvider } from "@/app/_ui";

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
vi.mock("next/headers", () => ({
  headers: async () => new Map([["host", "mocks.example.com"], ["x-forwarded-proto", "https"]]),
}));

function fixtureBundle(docsEnabled: boolean) {
  return {
    builtAt: "2026-01-01T00:00:00.000Z",
    commit: "abc123",
    warnings: [],
    projects: {
      demo: {
        name: "Demo API",
        slug: "demo",
        basePath: undefined,
        defaults: { delayMs: 0, cors: true, notFound: { status: 404, body: null } },
        routes: [
          {
            id: "get-x",
            method: "GET",
            path: "/x",
            segments: [],
            response: { status: 200, body: { ok: true } },
          },
        ],
        docs: docsEnabled ? { enabled: true, description: "Read me" } : { enabled: false },
      },
    },
  };
}

let currentBundle = fixtureBundle(true);
vi.mock("@/src/store/merge-into-bundle", () => ({
  withStoreProjects: async () => currentBundle,
}));

const { default: DocsPage } = await import("./page");

afterEach(() => {
  cleanup();
  currentBundle = fixtureBundle(true);
});

function resolvedParams(slug: string) {
  return Promise.resolve({ slug });
}

describe("DocsPage (plan 18)", () => {
  it("renders the project name, description, base URL and a working curl", async () => {
    const el = await DocsPage({ params: resolvedParams("demo") });
    render(<ToastProvider>{el}</ToastProvider>);
    expect(screen.getByText("Demo API")).toBeDefined();
    expect(screen.getByText("Read me")).toBeDefined();
    expect(screen.getByText(/mocks\.example\.com\/m\/demo\/x/)).toBeDefined();
    expect(screen.getByText(/curl -sS/)).toBeDefined();
  });

  it("404s when docs.enabled is false", async () => {
    currentBundle = fixtureBundle(false);
    await expect(DocsPage({ params: resolvedParams("demo") })).rejects.toThrow();
  });

  it("404s for an unknown project", async () => {
    await expect(DocsPage({ params: resolvedParams("nope") })).rejects.toThrow();
  });
});
