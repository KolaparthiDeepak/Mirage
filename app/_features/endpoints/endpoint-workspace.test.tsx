import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import { afterEach, describe, it, expect, vi } from "vitest";
import type { ProjectVM } from "@/src/viewer/model";
import { ViewModelProvider } from "@/app/_lib/view-model-context";
import { ToastProvider } from "@/app/_ui";
import { EndpointWorkspace } from "./EndpointWorkspace";
import EndpointsPage from "@/app/(app)/p/[slug]/endpoints/page";

const nav = vi.hoisted(() => ({
  sp: new URLSearchParams("e=EP1&c=C1"),
  replace: vi.fn(),
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => nav.sp,
  useRouter: () => ({ replace: nav.replace, push: nav.push }),
  usePathname: () => "/p/x/endpoints",
}));

const project = {
  slug: "x",
  name: "X",
  caseCount: 1,
  endpoints: [
    {
      key: "EP1",
      method: "GET",
      path: "/x/EP1/v1",
      runUrl: "",
      summary: "First",
      cases: [
        {
          id: "C1",
          label: "case one",
          isOpenApiGenerated: false,
          match: [],
          expected: { status: 200, body: null },
          request: {
            method: "GET",
            url: "http://localhost/m/x/EP1/v1",
            headers: {},
            curl: "curl http://localhost/m/x/EP1/v1",
            notes: [],
          },
        },
      ],
    },
    { key: "EP2", method: "POST", path: "/x/EP2/v1", runUrl: "", summary: "Second", cases: [] },
  ],
} as unknown as ProjectVM;

const model = {
  build: { commit: "x", builtAt: "", warnings: [] },
  projects: [project],
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

afterEach(() => {
  cleanup();
  nav.sp = new URLSearchParams("e=EP1&c=C1");
  nav.replace.mockClear();
  nav.push.mockClear();
});

describe("EndpointWorkspace", () => {
  it("reflects ?e= / ?c= selection across the three columns", () => {
    render(
      <ToastProvider>
        <EndpointWorkspace project={project} />
      </ToastProvider>,
    );

    const lists = screen.getAllByRole("listbox");
    const endpointRow = within(lists[0]!).getByText("EP1").closest("[role=option]")!;
    expect(endpointRow.getAttribute("aria-selected")).toBe("true");

    const caseRow = within(lists[1]!).getByText("case one").closest("[role=option]")!;
    expect(caseRow.getAttribute("aria-selected")).toBe("true");

    expect(screen.getByRole("button", { name: "Execute" })).toBeDefined();
    expect(screen.getByRole("tab", { name: "cURL" })).toBeDefined();
  });

  it("selecting another endpoint replaces ?e= and clears ?c=", () => {
    render(
      <ToastProvider>
        <EndpointWorkspace project={project} />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByText("EP2"));
    expect(nav.replace).toHaveBeenCalledTimes(1);
    const url = nav.replace.mock.calls[0]![0] as string;
    expect(url).toContain("e=EP2");
    expect(url).not.toContain("c=");
  });

  it("shows an empty state when no case is selected", () => {
    nav.sp = new URLSearchParams("e=EP1");
    render(
      <ToastProvider>
        <EndpointWorkspace project={project} />
      </ToastProvider>,
    );
    expect(screen.getByText("Pick a case")).toBeDefined();
  });
});

describe("Endpoints page routing", () => {
  function renderPage() {
    return render(
      <ViewModelProvider model={model}>
        <EndpointsPage params={resolvedParams("x")} />
      </ViewModelProvider>,
    );
  }

  it("renders the list view when ?e= is absent", () => {
    nav.sp = new URLSearchParams();
    renderPage();
    expect(screen.getByLabelText("Search endpoints")).toBeDefined();
  });

  it("renders the workspace when ?e= is present", () => {
    nav.sp = new URLSearchParams("e=EP1");
    renderPage();
    expect(screen.queryByLabelText("Search endpoints")).toBeNull();
    expect(screen.getByText("Pick a case")).toBeDefined();
  });
});
