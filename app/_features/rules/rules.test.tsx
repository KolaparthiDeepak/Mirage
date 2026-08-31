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
      target: { value: "alpha" },
    });

    const stored = JSON.parse(sessionStorage.getItem("mockservers-preview")!);
    expect(stored.rulesDraft[endpoint.key][0].field).toBe("body.cardLast4");

    fireEvent.click(screen.getByRole("button", { name: "Export YAML" }));
    const pre = screen.getByText(/jsonPath: \$\.cardLast4/);
    expect(pre.textContent).toContain('equals: "0001"');
  });
});
