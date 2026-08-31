import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, describe, it, expect, vi } from "vitest";
import type { ProjectVM } from "@/src/viewer/model";
import { ViewModelProvider } from "@/app/_lib/view-model-context";
import { caseHref } from "@/app/_lib/nav";
import { TrafficTable } from "./TrafficTable";
import { TrafficDrawer } from "./TrafficDrawer";
import type { TrafficEntry } from "./sample-traffic";
import TrafficPage from "@/app/(app)/p/[slug]/traffic/page";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/p/demo/traffic",
}));

const draft = { method: "GET", url: "", headers: {}, curl: "", notes: [] };

const project = {
  slug: "demo",
  name: "Demo",
  caseCount: 1,
  endpoints: [
    {
      key: "GET_CARD",
      method: "GET",
      path: "/x/GET_CARD/v1",
      runUrl: "",
      cases: [
        {
          id: "c1",
          label: "happy",
          isOpenApiGenerated: false,
          match: [],
          expected: { status: 200, body: { ok: true } },
          request: { ...draft, body: '{"a":1}' },
        },
      ],
    },
  ],
} as unknown as ProjectVM;

const entries: TrafficEntry[] = [
  {
    id: "e1",
    method: "GET",
    endpointKey: "GET_CARD",
    path: "/x/GET_CARD/v1",
    status: 200,
    at: "10:42:31",
    ms: 8,
    reqHeaders: { "content-type": "application/json" },
    reqBody: '{"a":1}',
    resBody: '{"ok":true}',
  },
  {
    id: "e2",
    method: "POST",
    endpointKey: "GET_CARD",
    path: "/x/GET_CARD/v1",
    status: 404,
    at: "10:41:58",
    ms: 12,
    reqHeaders: { "content-type": "application/json" },
    reqBody: "{}",
    resBody: "{}",
  },
];

function resolvedParams(slug: string) {
  const p = Promise.resolve({ slug }) as Promise<{ slug: string }> & {
    status: string;
    value: { slug: string };
  };
  p.status = "fulfilled";
  p.value = { slug };
  return p;
}

afterEach(() => {
  push.mockClear();
  cleanup();
});

describe("TrafficTable", () => {
  it("renders a row per entry and reports the clicked id", () => {
    const onSelect = vi.fn();
    render(<TrafficTable entries={entries} onSelect={onSelect} />);
    expect(screen.getAllByRole("row")).toHaveLength(entries.length + 1); // + header row
    fireEvent.click(screen.getByText("10:42:31").closest("tr")!);
    expect(onSelect).toHaveBeenCalledWith("e1");
  });

  it("makes the first body row tabbable when nothing is selected (roving fallback)", () => {
    render(<TrafficTable entries={entries} />);
    const rows = screen.getAllByRole("row").slice(1); // drop the header row
    expect(rows[0]!.getAttribute("tabindex")).toBe("0");
    expect(rows[1]!.getAttribute("tabindex")).toBe("-1");
  });

  it("shows an empty state with no entries", () => {
    render(<TrafficTable entries={[]} />);
    expect(screen.getByText("No traffic")).toBeDefined();
  });

  it("labels every body cell with data-label for the stacked mobile layout", () => {
    render(<TrafficTable entries={entries} />);
    const cells = document.querySelectorAll("tbody td");
    expect(cells.length).toBe(entries.length * 5);
    cells.forEach((td) => expect(td.getAttribute("data-label")).toBeTruthy());
  });
});

describe("TrafficDrawer", () => {
  it("shows the response JSON and replays via caseHref", () => {
    render(
      <TrafficDrawer entry={entries[0]!} project={project} open onClose={vi.fn()} />,
    );
    expect(screen.getByText(/"ok"/)).toBeDefined();
    fireEvent.click(screen.getByText("Replay request"));
    expect(push).toHaveBeenCalledWith(caseHref("demo", "GET_CARD", "c1"));
  });
});

describe("Traffic page", () => {
  it("renders a Preview badge and the traffic table", () => {
    render(
      <ViewModelProvider model={{ build: { commit: "x", builtAt: "", warnings: [] }, projects: [project] } as never}>
        <TrafficPage params={resolvedParams("demo")} />
      </ViewModelProvider>,
    );
    expect(screen.getByText("Preview")).toBeDefined();
    expect(screen.getByRole("table")).toBeDefined();
  });
});
