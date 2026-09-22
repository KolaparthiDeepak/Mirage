import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { setAdminToken } from "@/app/_lib/admin-token";
import { ProjectEmptyState } from "./ProjectEmptyState";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

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
  push.mockClear();
  vi.unstubAllGlobals();
  cleanup();
});

describe("ProjectEmptyState — Try a sample (plan 23)", () => {
  it("creates the sample project and its three rules, then navigates to it", async () => {
    fetchSpy = vi.fn(async () => ({ ok: true, status: 201, json: async () => ({}) }));
    global.fetch = fetchSpy as unknown as typeof fetch;

    render(<ProjectEmptyState />);
    fireEvent.click(screen.getByRole("button", { name: "Try a sample" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/p/sample-api"));
    // 1 project create + 3 rule creates.
    expect(fetchSpy).toHaveBeenCalledTimes(4);
    expect(fetchSpy.mock.calls[0]![0]).toBe("/api/projects");
    const ruleUrls = fetchSpy.mock.calls.slice(1).map((c) => c[0]);
    expect(ruleUrls.every((u) => u === "/api/projects/sample-api/rules")).toBe(true);
  });

  it("shows the server's error and does not navigate on failure", async () => {
    fetchSpy = vi.fn(async () => ({ ok: false, status: 500, json: async () => ({ error: "boom" }) }));
    global.fetch = fetchSpy as unknown as typeof fetch;

    render(<ProjectEmptyState />);
    fireEvent.click(screen.getByRole("button", { name: "Try a sample" }));

    await waitFor(() => expect(screen.getByText("boom")).toBeDefined());
    expect(push).not.toHaveBeenCalled();
  });
});
