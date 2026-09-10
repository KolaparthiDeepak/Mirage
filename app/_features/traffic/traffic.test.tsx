import type { ReactNode } from "react";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import type { TrafficEntry } from "@/src/store/types";
import { ToastProvider } from "@/app/_ui";
import { TrafficTable } from "./TrafficTable";
import { TrafficDrawer } from "./TrafficDrawer";
import { TrafficView } from "./TrafficView";
import TrafficPage from "@/app/(app)/p/[slug]/traffic/page";

// TrafficDrawer's cURL button (CopyButton) needs a ToastProvider ancestor.
function withToast(node: ReactNode) {
  return <ToastProvider>{node}</ToastProvider>;
}

const { push, replace } = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
let searchParamsString = "";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace }),
  usePathname: () => "/p/demo/traffic",
  useSearchParams: () => new URLSearchParams(searchParamsString),
}));

function entry(over: Partial<TrafficEntry> = {}): TrafficEntry {
  return {
    id: "e1",
    slug: "demo",
    at: "2026-01-01T10:42:31.000Z",
    method: "GET",
    path: "/x/GET_CARD/v1",
    query: {},
    reqHeaders: { "content-type": "application/json" },
    reqBody: '{"a":1}',
    status: 200,
    resHeaders: { "content-type": "application/json" },
    resBody: '{"ok":true}',
    matchedRuleId: "get-card",
    durationMs: 8,
    warnings: [],
    clientHash: null,
    configVersion: 1,
    truncated: false,
    viaUpstream: false,
    ...over,
  };
}

const entries: TrafficEntry[] = [
  entry(),
  entry({ id: "e2", method: "POST", status: 404, matchedRuleId: null, durationMs: 12, at: "2026-01-01T10:41:58.000Z" }),
];

function resolvedParams(slug: string) {
  // React's use() only unwraps a promise synchronously (no Suspense) when the
  // thenable already carries this fulfilled-cache shape — a plain
  // Promise.resolve() still suspends on first render.
  const p = Promise.resolve({ slug }) as Promise<{ slug: string }> & {
    status: string;
    value: { slug: string };
  };
  p.status = "fulfilled";
  p.value = { slug };
  return p;
}

function mockFetchJson(handler: (url: string) => unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL) => {
      const url = String(input);
      return { ok: true, json: async () => handler(url) } as Response;
    }),
  );
}

beforeEach(() => {
  searchParamsString = "";
});

afterEach(() => {
  push.mockClear();
  replace.mockClear();
  vi.unstubAllGlobals();
  cleanup();
});

describe("TrafficTable", () => {
  it("renders a row per entry and reports the clicked id", () => {
    const onSelect = vi.fn();
    render(<TrafficTable entries={entries} onSelect={onSelect} />);
    expect(screen.getAllByRole("row")).toHaveLength(entries.length + 1); // + header row
    fireEvent.click(screen.getByText("get-card").closest("tr")!);
    expect(onSelect).toHaveBeenCalledWith("e1");
  });

  it("shows an unmatched row's rule cell as 'unmatched'", () => {
    render(<TrafficTable entries={entries} />);
    expect(screen.getByText("unmatched")).toBeDefined();
  });

  it("shows an empty state with no entries", () => {
    render(<TrafficTable entries={[]} />);
    expect(screen.getByText("No traffic")).toBeDefined();
  });

  it("labels every body cell with data-label for the stacked mobile layout", () => {
    render(<TrafficTable entries={entries} />);
    const cells = document.querySelectorAll("tbody td");
    expect(cells.length).toBe(entries.length * 6);
    cells.forEach((td) => expect(td.getAttribute("data-label")).toBeTruthy());
  });
});

describe("TrafficDrawer", () => {
  it("shows the response body and redacts a masked field with a visible label", async () => {
    mockFetchJson(() => ({
      outsideBasePath: false,
      traces: [{ ruleId: "get-card", method: "pass", path: "pass", match: "skip" }],
      winnerRuleId: "get-card",
      requestHints: [],
    }));
    render(
      withToast(<TrafficDrawer entry={entry({ resBody: "***", reqBody: '{"ok":1}' })} open onClose={vi.fn()} />),
    );
    expect(screen.getByText("***")).toBeDefined();
    expect(screen.getByText("(redacted)")).toBeDefined();
    await waitFor(() => expect(screen.getByText(/get-card/)).toBeDefined());
  });

  it("replay issues a raw fetch against the mock URL", async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL) => {
        calls.push(String(input));
        return { ok: true, status: 200, text: async () => "ok", json: async () => ({ traces: [], requestHints: [], winnerRuleId: null, outsideBasePath: false }) } as Response;
      }),
    );
    render(withToast(<TrafficDrawer entry={entry()} open onClose={vi.fn()} />));
    fireEvent.click(screen.getByText("Replay"));
    await waitFor(() => expect(calls.some((u) => u.includes("/m/demo/x/GET_CARD/v1"))).toBe(true));
  });
});

describe("TrafficView", () => {
  it("fetches on mount and renders a row per returned entry, with export buttons", async () => {
    mockFetchJson(() => ({ rows: entries, nextCursor: null }));
    render(withToast(<TrafficView slugs={["demo"]} exportName="x.json" />));
    await waitFor(() => expect(screen.getAllByRole("row")).toHaveLength(entries.length + 1));
    expect(screen.getByRole("button", { name: "Export JSON" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Export HAR" })).toBeDefined();
  });

  it("changing the method filter updates the URL", async () => {
    mockFetchJson(() => ({ rows: [], nextCursor: null }));
    render(withToast(<TrafficView slugs={["demo"]} exportName="x.json" />));
    await waitFor(() => expect(screen.getByRole("combobox", { name: "Filter by method" })).toBeDefined());
    fireEvent.change(screen.getByLabelText("Filter by method"), { target: { value: "POST" } });
    expect(replace).toHaveBeenCalledWith(expect.stringContaining("method=POST"), expect.anything());
  });
});

describe("Traffic page", () => {
  it("renders real rows once the fetch resolves", async () => {
    mockFetchJson(() => ({ rows: entries, nextCursor: null }));
    render(withToast(<TrafficPage params={resolvedParams("demo")} />));
    await waitFor(() => expect(screen.getAllByRole("row").length).toBeGreaterThan(1));
  });

  it("shows the empty state when there is no traffic yet", async () => {
    mockFetchJson(() => ({ rows: [], nextCursor: null }));
    render(withToast(<TrafficPage params={resolvedParams("demo")} />));
    await waitFor(() => expect(screen.getByText("No traffic")).toBeDefined());
  });
});
