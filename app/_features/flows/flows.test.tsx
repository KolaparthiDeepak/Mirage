import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setAdminToken } from "@/app/_lib/admin-token";
import { FlowsPanel } from "./FlowsPanel";

let fetchSpy: ReturnType<typeof vi.fn>;
beforeEach(() => {
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  });
  setAdminToken("test-token");
});

afterEach(() => {
  vi.unstubAllGlobals();
  cleanup();
});

describe("FlowsPanel", () => {
  it("shows an empty state pointing at the API when there are no flows", async () => {
    fetchSpy = vi.fn(async () => ({ ok: true, json: async () => ({ flows: [] }) }));
    global.fetch = fetchSpy as unknown as typeof fetch;
    render(<FlowsPanel slug="demo" />);
    expect(await screen.findByText("No flows yet")).toBeDefined();
  });

  it("lists flows and shows per-step results after Run", async () => {
    fetchSpy = vi.fn(async (url: string) => {
      if (url.endsWith("/flows")) return { ok: true, json: async () => ({ flows: [{ id: "f1", name: "Happy path", updatedAt: "x" }] }) };
      return {
        ok: true,
        status: 200,
        json: async () => ({
          runId: "r1",
          status: "failed",
          steps: [{ name: "step1", method: "GET", path: "/a", status: 200, matchedRuleId: "r", passed: true, assertions: [] }],
        }),
      };
    });
    global.fetch = fetchSpy as unknown as typeof fetch;

    render(<FlowsPanel slug="demo" />);
    expect(await screen.findByText("Happy path")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "Run" }));
    await waitFor(() => expect(screen.getByText("step1")).toBeDefined());
    expect(screen.getByText("failed")).toBeDefined();
  });
});
