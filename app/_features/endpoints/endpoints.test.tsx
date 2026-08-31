import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen, fireEvent, cleanup, waitFor, within } from "@testing-library/react";
import { afterEach, describe, it, expect, vi } from "vitest";
import { useState } from "react";
import type { EndpointVM } from "@/src/viewer/model";
import { ViewModelProvider } from "@/app/_lib/view-model-context";
import { EndpointList } from "./EndpointList";
import { EndpointRow } from "./EndpointRow";
import EndpointsPage from "@/app/(app)/p/[slug]/endpoints/page";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/p/demo/endpoints",
  useSearchParams: () => new URLSearchParams(),
}));

function ep(key: string, method: string, nCases: number, summary?: string): EndpointVM {
  return {
    key,
    method,
    path: `/demo/${key}/v1`,
    runUrl: "",
    summary,
    cases: Array.from({ length: nCases }, (_, i) => ({
      id: `${key}-${i}`,
      label: "",
      isOpenApiGenerated: false,
      match: [],
      expected: { status: 200 },
      request: { method, url: "", headers: {}, curl: "", notes: [] },
    })),
  };
}

const endpoints = [
  ep("GET_CARD", "GET", 3, "Fetch a card"),
  ep("BLOCK_CARD", "POST", 1),
  ep("UNBLOCK_CARD", "POST", 2),
  ep("DELETE_CARD", "DELETE", 0),
];

const model = {
  build: { commit: "x", builtAt: "", warnings: [] },
  projects: [{ slug: "demo", name: "Demo", caseCount: 6, endpoints }],
} as never;

function resolvedParams(slug: string) {
  const p = Promise.resolve({ slug }) as Promise<{ slug: string }> & {
    status: string;
    value: { slug: string };
  };
  p.status = "fulfilled";
  p.value = { slug };
  return p;
}

function ListHarness() {
  const [sel, setSel] = useState<string | null>(null);
  return <EndpointList endpoints={endpoints} selectedKey={sel} onSelect={setSel} />;
}

afterEach(() => {
  cleanup();
  push.mockClear();
  vi.useRealTimers();
});

describe("EndpointList", () => {
  it("renders a row per endpoint with its case count", () => {
    render(<ListHarness />);
    expect(screen.getAllByRole("option")).toHaveLength(4);
    expect(screen.getByText("3 cases")).toBeDefined();
    expect(screen.getByText("0 cases")).toBeDefined();
  });

  it("makes the first row tabbable when nothing is selected (roving fallback)", () => {
    render(<ListHarness />);
    const rows = screen.getAllByRole("option");
    expect(rows[0]!.getAttribute("tabindex")).toBe("0");
    expect(rows[1]!.getAttribute("tabindex")).toBe("-1");
  });

  it("ArrowDown from the first row selects the second", () => {
    render(<ListHarness />);
    const rows = screen.getAllByRole("option");
    fireEvent.keyDown(rows[0]!, { key: "ArrowDown" });
    expect(rows[1]!.getAttribute("aria-selected")).toBe("true");
    expect(rows[0]!.getAttribute("aria-selected")).toBe("false");
  });

  it("Enter selects the focused row", () => {
    render(<ListHarness />);
    const rows = screen.getAllByRole("option");
    fireEvent.keyDown(rows[2]!, { key: "Enter" });
    expect(rows[2]!.getAttribute("aria-selected")).toBe("true");
  });
});

describe("EndpointRow truncation", () => {
  it("keeps the name and its meta rendered for a very long mono name", () => {
    const long = ep(
      "CHECK_CARD_ELIGIBILITY_FOR_INTERNATIONAL_TRANSACTIONS_AND_MORE",
      "POST",
      12,
      "A summary long enough to overflow the endpoints column many times over",
    );
    render(<EndpointRow endpoint={long} />);
    expect(screen.getByText(long.key)).toBeDefined();
    expect(screen.getByText("12 cases")).toBeDefined();
  });

  it(".code carries the ellipsis rule in the CSS module", () => {
    const css = readFileSync(
      join(process.cwd(), "app/_features/endpoints/endpoints.module.css"),
      "utf8",
    );
    const block = css.match(/\.code\s*\{[^}]*\}/)?.[0] ?? "";
    expect(block).toMatch(/text-overflow:\s*ellipsis/);
    expect(block).toMatch(/overflow:\s*hidden/);
  });
});

describe("Endpoints page", () => {
  const rows = () => within(screen.getByRole("listbox")).getAllByRole("option");

  function renderPage() {
    return render(
      <ViewModelProvider model={model}>
        <EndpointsPage params={resolvedParams("demo")} />
      </ViewModelProvider>,
    );
  }

  it("lists every endpoint and filters as you type (debounced)", async () => {
    renderPage();
    expect(rows()).toHaveLength(4);
    fireEvent.change(screen.getByLabelText("Search endpoints"), {
      target: { value: "block" },
    });
    await waitFor(() => expect(rows()).toHaveLength(2));
  });

  it("filters by method", async () => {
    renderPage();
    fireEvent.change(screen.getByLabelText("Filter by method"), {
      target: { value: "DELETE" },
    });
    await waitFor(() => expect(rows()).toHaveLength(1));
  });

  it("pushes ?e=<key> when a row is clicked", () => {
    renderPage();
    fireEvent.click(screen.getByText("GET_CARD"));
    expect(push).toHaveBeenCalledWith("/p/demo/endpoints?e=GET_CARD");
  });

  it("percent-encodes the endpoint key in the pushed URL and round-trips it", () => {
    const spacedKey = "POST /demo/GET_CARD/v1";
    const spaced = {
      build: { commit: "x", builtAt: "", warnings: [] },
      projects: [
        {
          slug: "demo",
          name: "Demo",
          caseCount: 0,
          endpoints: [{ ...ep("GET_CARD", "GET", 1), key: spacedKey }],
        },
      ],
    } as never;
    render(
      <ViewModelProvider model={spaced}>
        <EndpointsPage params={resolvedParams("demo")} />
      </ViewModelProvider>,
    );
    fireEvent.click(screen.getByText("GET_CARD"));
    const url = push.mock.calls[0]![0] as string;
    expect(url).toBe(`/p/demo/endpoints?e=${encodeURIComponent(spacedKey)}`);
    expect(new URL(url, "http://x").searchParams.get("e")).toBe(spacedKey);
  });

  it("switching to Grouped renders group labels", () => {
    renderPage();
    fireEvent.click(screen.getByRole("tab", { name: "Grouped" }));
    expect(screen.getByText("/demo")).toBeDefined();
  });
});
