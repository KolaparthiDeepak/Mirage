import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { ToastProvider } from "@/app/_ui";
import { setAdminToken } from "@/app/_lib/admin-token";
import { FirstMockOnboarding } from "./FirstMockOnboarding";

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
  cleanup();
  vi.unstubAllGlobals();
});

function wrap(ui: React.ReactNode) {
  return render(<ToastProvider>{ui}</ToastProvider>);
}

describe("FirstMockOnboarding (plan 23)", () => {
  it("shows the Live-now panel with URL and curl after creating a mock", async () => {
    fetchSpy = vi.fn(async (url: string) => {
      if (url.endsWith("/rules")) return { ok: true, status: 201, json: async () => ({}) };
      return { ok: true, status: 200, json: async () => ({ rows: [] }) };
    });
    global.fetch = fetchSpy as unknown as typeof fetch;

    wrap(<FirstMockOnboarding slug="demo" />);
    fireEvent.change(screen.getByPlaceholderText("/my/path"), { target: { value: "/hello" } });
    fireEvent.click(screen.getByRole("button", { name: "Create mock" }));

    await waitFor(() => expect(screen.getByText("Live now")).toBeDefined());
    expect(screen.getByText("http://localhost:3000/m/demo/hello")).toBeDefined();
    expect(screen.getByText("curl -sS http://localhost:3000/m/demo/hello")).toBeDefined();
    expect(screen.getByText(/waiting for your first request/)).toBeDefined();
  });

  it("flips the waiting indicator to the first request once traffic arrives", async () => {
    let callCount = 0;
    fetchSpy = vi.fn(async (url: string) => {
      if (url.endsWith("/rules")) return { ok: true, status: 201, json: async () => ({}) };
      callCount += 1;
      const rows =
        callCount === 1
          ? []
          : [{ id: "t1", method: "GET", path: "/hello", status: 200, durationMs: 3, at: "x" }];
      return { ok: true, status: 200, json: async () => ({ rows }) };
    });
    global.fetch = fetchSpy as unknown as typeof fetch;

    wrap(<FirstMockOnboarding slug="demo" />);
    fireEvent.change(screen.getByPlaceholderText("/my/path"), { target: { value: "/hello" } });
    fireEvent.click(screen.getByRole("button", { name: "Create mock" }));

    await waitFor(() => expect(screen.getByText("Live now")).toBeDefined());
    expect(screen.getByText(/waiting for your first request/)).toBeDefined();
  });
});
