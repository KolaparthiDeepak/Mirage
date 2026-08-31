import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { afterEach, describe, it, expect, vi } from "vitest";
import type { CaseVM } from "@/src/viewer/model";
import type { Verdict } from "@/src/viewer/verdict";
import { ToastProvider } from "@/app/_ui";
import { RequestBuilder } from "./RequestBuilder";
import { ResponseViewer } from "./ResponseViewer";
import { VerdictLine } from "./VerdictLine";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const renderT = (ui: React.ReactElement) =>
  render(<ToastProvider>{ui}</ToastProvider>);

const fixture: CaseVM = {
  id: "case-1",
  label: "case-1",
  isOpenApiGenerated: false,
  match: [],
  expected: { status: 200, body: null },
  request: {
    method: "POST",
    url: "http://localhost/m/demo/x",
    headers: { "content-type": "application/json" },
    body: '{"a":1}',
    curl: "",
    notes: ["templated field"],
  },
} as CaseVM;

function okResponse(headers?: Record<string, string>) {
  return {
    status: 200,
    text: () => Promise.resolve('{"ok":true}'),
    headers: new Headers({ "content-type": "application/json", ...headers }),
  };
}

describe("RequestBuilder", () => {
  it("executes, shows the response and calls onExecuted", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse());
    vi.stubGlobal("fetch", fetchMock);
    const onExecuted = vi.fn();
    const { container } = renderT(
      <RequestBuilder case_={fixture} onExecuted={onExecuted} />,
    );

    fireEvent.click(screen.getByText("Execute"));

    await waitFor(() => screen.getByText("200"));
    expect(screen.getByText('"ok"')).toBeDefined();
    expect(container.textContent).toContain('"ok": true');
    expect(onExecuted).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledOnce();

    const [calledUrl, init] = fetchMock.mock.calls[0]!;
    expect(calledUrl).toBe("http://localhost/m/demo/x");
    expect(init.method).toBe("POST");
    expect(init.body).toBe('{"a":1}');
    expect(init.headers).toEqual({ "content-type": "application/json" });
  });

  it("omits the body for a GET (noBody rule)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse());
    vi.stubGlobal("fetch", fetchMock);
    renderT(<RequestBuilder case_={fixture} />);

    fireEvent.change(screen.getByLabelText("Request Method"), {
      target: { value: "GET" },
    });
    fireEvent.click(screen.getByText("Execute"));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(fetchMock.mock.calls[0]![1].method).toBe("GET");
    expect(fetchMock.mock.calls[0]![1].body).toBeUndefined();
  });

  it("classifies a response whose x-mock-rule-id matches the case as a hit", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(okResponse({ "x-mock-rule-id": "case-1" }));
    vi.stubGlobal("fetch", fetchMock);
    const { container } = renderT(<RequestBuilder case_={fixture} />);

    fireEvent.click(screen.getByText("Execute"));

    await waitFor(() => screen.getByText("✓ matched case: case-1"));
    expect(container.querySelector('[data-kind="hit"]')).not.toBeNull();
  });

  it("shows an error line when fetch rejects, without crashing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    renderT(<RequestBuilder case_={fixture} />);

    fireEvent.click(screen.getByText("Execute"));

    await waitFor(() => screen.getByRole("alert"));
    expect(screen.getByRole("alert").textContent).toContain("network down");
  });

  it("⌘↵ inside the builder triggers Execute", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse());
    vi.stubGlobal("fetch", fetchMock);
    const { container } = renderT(<RequestBuilder case_={fixture} />);

    fireEvent.keyDown(container.firstElementChild as Element, {
      key: "Enter",
      metaKey: true,
    });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
  });

  it("renders request notes", () => {
    vi.stubGlobal("fetch", vi.fn());
    renderT(<RequestBuilder case_={fixture} />);
    expect(screen.getByText(/templated field/)).toBeDefined();
  });
});

describe("ResponseViewer", () => {
  it("renders status, timing and byte size", () => {
    render(
      <ResponseViewer
        result={{
          status: 404,
          ms: 12,
          headers: [],
          bodyText: "abcd",
          verdict: { kind: "nomatch" },
        }}
      />,
    );
    expect(screen.getByText("404")).toBeDefined();
    expect(screen.getByText("12 ms")).toBeDefined();
    expect(screen.getByText("4 B")).toBeDefined();
  });
});

describe("VerdictLine", () => {
  const cases: [Verdict, string, string][] = [
    [{ kind: "hit", caseId: "c1" }, "hit", "✓ matched case: c1"],
    [{ kind: "divert", landedOn: "c2" }, "divert", "→ landed on: c2"],
    [
      { kind: "nomatch" },
      "nomatch",
      "→ no route matched (fell through to notFound)",
    ],
    [
      { kind: "unknown" },
      "unknown",
      "· could not confirm which case matched",
    ],
  ];

  it.each(cases)("%o -> data-kind + text", (verdict, kind, text) => {
    const { container } = render(<VerdictLine verdict={verdict} />);
    const p = container.querySelector("p")!;
    expect(p.dataset.kind).toBe(kind);
    expect(p.textContent).toBe(text);
  });
});
