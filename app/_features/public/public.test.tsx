import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, it, expect } from "vitest";
import { ProjectConfigProvider } from "@/app/_lib/project-config-context";
import { ToastProvider } from "@/app/_ui";
import { PublicServerPanel } from "./PublicServerPanel";

afterEach(() => cleanup());

const configs = {
  "card-block-lost": {
    name: "Card Block",
    basePath: "/commands",
    defaults: { delayMs: 250, cors: true },
    hasOpenApi: true,
  },
};

function renderPanel(hasOpenApi: boolean) {
  return render(
    <ProjectConfigProvider configs={configs}>
      <ToastProvider>
        <PublicServerPanel slug="card-block-lost" basePath="/commands" hasOpenApi={hasOpenApi} />
      </ToastProvider>
    </ProjectConfigProvider>,
  );
}

describe("PublicServerPanel", () => {
  it("renders the base URL and a Copy base URL button", () => {
    renderPanel(false);
    expect(screen.getByText("/m/card-block-lost/commands")).toBeDefined();
    expect(screen.getByRole("button", { name: "Copy base URL" })).toBeDefined();
  });

  it("hides the OpenAPI spec link when hasOpenApi is false", () => {
    renderPanel(false);
    expect(screen.queryByRole("link", { name: /spec/i })).toBeNull();
  });

  it("shows the OpenAPI spec link when hasOpenApi is true", () => {
    renderPanel(true);
    const link = screen.getByRole("link", { name: /spec/i });
    expect(link.getAttribute("href")).toBe("/m/card-block-lost/__spec");
  });
});
