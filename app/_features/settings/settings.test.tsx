import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { ProjectConfigProvider } from "@/app/_lib/project-config-context";
import { ViewModelProvider } from "@/app/_lib/view-model-context";
import { ToastProvider } from "@/app/_ui";
import { setAdminToken } from "@/app/_lib/admin-token";
import type { ProjectVM } from "@/src/viewer/model";
import { SettingsTabs } from "./SettingsTabs";

const { replace, push } = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(""),
  useRouter: () => ({ replace, push }),
  usePathname: () => "/p/card-block-lost/settings",
}));

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
  fetchSpy = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) }));
  global.fetch = fetchSpy as unknown as typeof fetch;
});

afterEach(() => {
  replace.mockClear();
  push.mockClear();
  vi.unstubAllGlobals();
  cleanup();
});

const proj: ProjectVM = {
  slug: "card-block-lost",
  name: "Card Block (Lost Card)",
  basePath: "/commands",
  endpoints: [],
  caseCount: 0,
};

const cfg = {
  name: "Card Block (Lost Card)",
  basePath: "/commands",
  defaults: { delayMs: 0, cors: true },
  hasOpenApi: true,
};

const model = {
  build: { commit: "x", builtAt: "", warnings: [] },
  projects: [proj],
};

function renderTabs() {
  return render(
    <ProjectConfigProvider configs={{ "card-block-lost": cfg }}>
      <ViewModelProvider model={model as never}>
        <ToastProvider>
          <SettingsTabs slug="card-block-lost" project={proj} config={cfg} />
        </ToastProvider>
      </ViewModelProvider>
    </ProjectConfigProvider>,
  );
}

describe("SettingsTabs", () => {
  it("pre-fills the General tab from the real config", () => {
    renderTabs();
    expect(screen.getByDisplayValue("Card Block (Lost Card)")).toBeDefined();
    expect(screen.getByDisplayValue("/commands")).toBeDefined();
  });

  it("General tab saves for real via PATCH", async () => {
    renderTabs();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(url).toBe("/api/projects/card-block-lost");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body)).toEqual({ name: "Card Block (Lost Card)", basePath: "/commands" });
    await waitFor(() => expect(screen.getByText(/Saved/)).toBeDefined());
  });

  it("shows read-only server facts", () => {
    renderTabs();
    fireEvent.click(screen.getByRole("tab", { name: "Server" }));
    expect(screen.getByText("enabled")).toBeDefined();
    expect(screen.getByText("0 ms")).toBeDefined();
  });

  it("Danger Zone requires typing the slug before deleting for real", async () => {
    renderTabs();
    fireEvent.click(screen.getByRole("tab", { name: "Danger Zone" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete project" }));

    const confirmBtn = screen.getByRole("button", { name: "Delete permanently" }) as HTMLButtonElement;
    expect(confirmBtn.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText("Type the project slug to confirm"), {
      target: { value: "card-block-lost" },
    });
    expect(confirmBtn.disabled).toBe(false);

    fireEvent.click(confirmBtn);
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(url).toBe("/api/projects/card-block-lost");
    expect(init.method).toBe("DELETE");
    await waitFor(() => expect(push).toHaveBeenCalledWith("/projects"));
  });
});
