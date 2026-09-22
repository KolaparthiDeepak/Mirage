import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { ToastProvider } from "@/app/_ui";
import type { EndpointVM } from "@/src/viewer/model";
import { setAdminToken } from "@/app/_lib/admin-token";
import { CreateProjectModal } from "@/app/_features/projects/CreateProjectModal";
import { CreateEndpointModal } from "@/app/_features/endpoints/CreateEndpointModal";
import { CreateCaseModal } from "@/app/_features/cases/CreateCaseModal";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

afterEach(() => {
  push.mockClear();
  vi.unstubAllGlobals();
  cleanup();
});

let fetchSpy: ReturnType<typeof vi.fn>;
beforeEach(() => {
  // Real jsdom localStorage isn't reliably present in this test environment —
  // same reason theme.test.tsx stubs it with a Map-backed fake instead of
  // relying on the real thing.
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

function wrap(ui: React.ReactNode) {
  return render(<ToastProvider>{ui}</ToastProvider>);
}

describe("CreateProjectModal", () => {
  it("blank mode: creates for real and navigates to the new project", async () => {
    wrap(<CreateProjectModal open onClose={() => {}} />);

    fireEvent.change(screen.getByPlaceholderText("My API"), { target: { value: "Card Service" } });
    expect(screen.getByText("slug: card-service")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(url).toBe("/api/projects");
    expect(JSON.parse(init.body)).toEqual({ name: "Card Service", slug: "card-service" });
    expect(init.headers.authorization).toBe("Bearer test-token");
    await waitFor(() => expect(push).toHaveBeenCalledWith("/p/card-service"));
  });

  it("shows the server's error message and does not navigate on failure", async () => {
    fetchSpy.mockResolvedValue({ ok: false, status: 409, json: async () => ({ error: "already exists" }) });
    wrap(<CreateProjectModal open onClose={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText("My API"), { target: { value: "Dup" } });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    await waitFor(() => expect(screen.getByText("already exists")).toBeDefined());
    expect(push).not.toHaveBeenCalled();
  });

  it("openapi mode still emits copy-paste YAML (import stays repo-based for now)", () => {
    wrap(<CreateProjectModal open onClose={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText("My API"), { target: { value: "Card Service" } });
    fireEvent.click(screen.getByRole("button", { name: /^OpenAPI/ }));
    fireEvent.click(screen.getByRole("button", { name: "Generate YAML" }));
    const pre = document.querySelector("pre")!;
    expect(pre.textContent).toContain('name: "Card Service"');
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("CreateEndpointModal", () => {
  it("creates for real with the chosen method, path and body", async () => {
    wrap(<CreateEndpointModal open onClose={() => {}} slug="demo" />);

    fireEvent.change(screen.getByPlaceholderText("/my/path"), { target: { value: "/x" } });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(url).toBe("/api/projects/demo/rules");
    const body = JSON.parse(init.body);
    expect(body.id).toBe("post-x-ok");
    expect(body.request).toEqual({ method: "POST", path: "/x" });
    expect(body.response.status).toBe(200);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/p/demo/endpoints?e=POST%20%2Fx"));
  });
});

const endpoint: EndpointVM = {
  key: "acropolis/BLOCK_CARD/v1",
  method: "POST",
  path: "/acropolis-card-mgmt/BLOCK_CARD/v1",
  runUrl: "/m/x",
  cases: [],
};

describe("CreateCaseModal", () => {
  it("creates for real with the slugified id and chosen status", async () => {
    wrap(<CreateCaseModal open onClose={() => {}} slug="demo" endpoint={endpoint} />);

    fireEvent.change(screen.getByPlaceholderText("card blocked"), { target: { value: "Card Blocked" } });
    fireEvent.change(screen.getByDisplayValue("200"), { target: { value: "404" } });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(url).toBe("/api/projects/demo/rules");
    const body = JSON.parse(init.body);
    expect(body.id).toBe("card-blocked");
    expect(body.response.status).toBe(404);
    expect(body.request).toEqual({ method: "POST", path: "/acropolis-card-mgmt/BLOCK_CARD/v1" });
  });
});
