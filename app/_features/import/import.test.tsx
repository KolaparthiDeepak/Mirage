import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { setAdminToken } from "@/app/_lib/admin-token";
import { ImportRulesModal } from "./ImportRulesModal";

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

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
  fetchSpy = vi.fn(async () => ({ ok: true, status: 201, json: async () => ({}) }));
  global.fetch = fetchSpy as unknown as typeof fetch;
});

afterEach(() => {
  refresh.mockClear();
  vi.unstubAllGlobals();
  cleanup();
});

describe("ImportRulesModal — cURL (plan 08)", () => {
  it("parses a pasted command, previews the draft, then creates it", async () => {
    render(<ImportRulesModal open onClose={() => {}} slug="demo" />);

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: `curl -X POST https://api.example.com/users -d '{"name":"Ada"}'` },
    });
    fireEvent.click(screen.getByRole("button", { name: "Parse" }));

    expect(await screen.findByText("POST /users")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: /Create 1 rule/ }));

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(url).toBe("/api/projects/demo/rules");
    const rule = JSON.parse(init.body);
    expect(rule.request).toMatchObject({ method: "POST", path: "/users" });
    expect(rule.request.match).toEqual([{ jsonPath: "$.name", equals: "Ada" }]);
    await waitFor(() => expect(screen.getByText(/Created 1 rule/)).toBeDefined());
    expect(refresh).toHaveBeenCalled();
  });

  it("reports a parse error instead of previewing", async () => {
    render(<ImportRulesModal open onClose={() => {}} slug="demo" />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "curl -X GET -H 'a: b'" } });
    fireEvent.click(screen.getByRole("button", { name: "Parse" }));
    expect(await screen.findByText(/no URL/)).toBeDefined();
  });

  it("counts a 409 as a skipped collision, not a failure", async () => {
    fetchSpy.mockResolvedValue({ ok: false, status: 409, json: async () => ({ error: "exists" }) });
    render(<ImportRulesModal open onClose={() => {}} slug="demo" />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "curl https://x/a" } });
    fireEvent.click(screen.getByRole("button", { name: "Parse" }));
    fireEvent.click(await screen.findByRole("button", { name: /Create 1 rule/ }));
    await waitFor(() => expect(screen.getByText(/skipped 1 that already exist/)).toBeDefined());
  });
});
