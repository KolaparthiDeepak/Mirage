import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, describe, it, expect } from "vitest";
import { PreviewProvider } from "@/app/_lib/preview-store";
import { ToastProvider } from "@/app/_ui";
import type { CaseVM, EndpointVM } from "@/src/viewer/model";
import { RuleList } from "./RuleList";
import { RuleBuilder } from "./RuleBuilder";

afterEach(() => {
  cleanup();
  sessionStorage.clear();
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
      id: "not-found",
      label: "not found",
      match: [{ jsonPath: "$.cardLast4", equals: "0001" }],
      expected: { status: 404 },
    }),
    makeCase({ id: "happy", label: "happy", match: [], expected: { status: 200 } }),
    makeCase({
      id: "qa-env",
      label: "qa env",
      match: [{ header: "X-Env", equals: "qa" }],
      expected: { status: 200 },
    }),
  ],
};

describe("RuleList", () => {
  it("renders one card per case in route order, marking the empty-match fallback", () => {
    render(<RuleList endpoint={endpoint} />);
    expect(screen.getByText("rule 1")).toBeDefined();
    expect(screen.getByText("rule 2")).toBeDefined();
    expect(screen.getByText("rule 3")).toBeDefined();
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

  it("writes a condition to the preview store and exports matching YAML", () => {
    renderBuilder();

    fireEvent.click(screen.getByRole("button", { name: "Add condition" }));
    fireEvent.change(screen.getByLabelText("Condition field"), {
      target: { value: "body.cardLast4" },
    });
    fireEvent.change(screen.getByLabelText("Condition operator"), {
      target: { value: "equals" },
    });
    fireEvent.change(screen.getByLabelText("Condition value"), {
      target: { value: "0001" },
    });
    fireEvent.change(screen.getByLabelText("Return case"), {
      target: { value: "not-found" },
    });

    const stored = JSON.parse(sessionStorage.getItem("mockservers-preview")!);
    expect(stored.rulesDraft[endpoint.key][0].field).toBe("body.cardLast4");

    fireEvent.click(screen.getByRole("button", { name: "Export YAML" }));
    const pre = screen.getByText(/jsonPath: \$\.cardLast4/);
    expect(pre.textContent).toContain('equals: "0001"');
  });
});
