import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { PreviewProvider } from "@/app/_lib/preview-store";
import { ToastProvider } from "@/app/_ui";
import { setAdminToken } from "@/app/_lib/admin-token";
import type { CaseVM, EndpointVM } from "@/src/viewer/model";
import { RuleList } from "./RuleList";
import { RuleBuilder } from "./RuleBuilder";

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
  fetchSpy = vi.fn(async () => ({ ok: true, json: async () => ({ warning: null }) }));
  global.fetch = fetchSpy as unknown as typeof fetch;
});

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.unstubAllGlobals();
});

function makeCase(over: Partial<CaseVM>): CaseVM {
  return {
    id: "c",
    label: "case",
    isOpenApiGenerated: false,
    match: [],
    expected: { status: 200 },
    request: {} as never,
    ...over,
  };
}

const endpoint: EndpointVM = {
  key: "POST /acropolis-card-mgmt/GET_CARD/v1",
  method: "POST",
  path: "/acropolis-card-mgmt/GET_CARD/v1",
  runUrl: "/m/x/acropolis-card-mgmt/GET_CARD/v1",
  cases: [
    makeCase({
      id: "alpha",
      label: "alpha",
      match: [{ jsonPath: "$.cardLast4", equals: "0001" }],
      expected: { status: 404 },
    }),
    makeCase({ id: "beta", label: "beta", match: [], expected: { status: 200 } }),
    makeCase({
      id: "gamma",
      label: "gamma",
      match: [{ header: "X-Env", equals: "qa" }],
      expected: { status: 200 },
    }),
  ],
};

describe("RuleList", () => {
  it("renders one card per case in route order, badge paired with the right case", () => {
    render(<RuleList endpoint={endpoint} />);

    const badges = screen.getAllByText(/^rule \d$/);
    expect(badges.map((b) => b.textContent)).toEqual([
      "rule 1",
      "rule 2",
      "rule 3",
    ]);

    // badge and case label are siblings in the card head — assert the pairing
    const labels = ["alpha", "beta", "gamma"];
    badges.forEach((badge, i) => {
      expect(badge.parentElement?.textContent).toBe(`rule ${i + 1}${labels[i]}`);
    });

    expect(screen.getByText("fallback — matches any request")).toBeDefined();
    expect(screen.getByText("404")).toBeDefined();
  });
});

describe("RuleBuilder", () => {
  function renderBuilder() {
    return render(
      <PreviewProvider>
        <ToastProvider>
          <RuleBuilder slug="x" endpoint={endpoint} />
        </ToastProvider>
      </PreviewProvider>,
    );
  }

  it("hydrates from the selected case's own match conditions on load", () => {
    renderBuilder();
    // "alpha" is selected by default (endpoint.cases[0]) and already has one
    // match condition — the builder must show it, not start blank.
    expect((screen.getByLabelText("Condition field") as HTMLInputElement).value).toBe("body.cardLast4");
    expect((screen.getByLabelText("Condition value") as HTMLInputElement).value).toBe("0001");
  });

  it("saves an edited condition via PATCH and reports success", async () => {
    renderBuilder();

    fireEvent.change(screen.getByLabelText("Condition value"), { target: { value: "0002" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(url).toBe("/api/projects/x/rules/alpha");
    expect(init.method).toBe("PATCH");
    const body = JSON.parse(init.body);
    expect(body.id).toBe("alpha");
    expect(body.request.match).toEqual([{ jsonPath: "$.cardLast4", equals: "0002" }]);
    expect(body.response).toEqual(endpoint.cases[0]!.expected);
    await waitFor(() => expect(screen.getByText(/Saved/)).toBeDefined());
  });

  it("switching the edited case re-hydrates its own conditions", () => {
    renderBuilder();
    fireEvent.change(screen.getByLabelText("Editing case"), { target: { value: "gamma" } });
    expect((screen.getByLabelText("Condition field") as HTMLInputElement).value).toBe("header.X-Env");
    expect((screen.getByLabelText("Condition value") as HTMLInputElement).value).toBe("qa");
  });

  it("shows the server's shadow warning after a save", async () => {
    fetchSpy.mockResolvedValue({ ok: true, json: async () => ({ warning: 'rule "alpha" is unreachable — rule "beta" above already matches everything it matches' }) });
    renderBuilder();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.getByText(/unreachable/)).toBeDefined());
  });
});
