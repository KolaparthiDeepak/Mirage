import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, it, expect } from "vitest";
import { ProjectConfigProvider, useProjectConfig } from "./project-config-context";

afterEach(() => cleanup());

const configs = {
  "card-block-lost": {
    name: "Card Block",
    basePath: "/commands",
    defaults: { delayMs: 0, cors: true },
    hasOpenApi: true,
  },
};

function Probe({ slug }: { slug: string }) {
  const config = useProjectConfig(slug);
  return <div>{config ? config.name : "null"}</div>;
}

describe("project-config-context", () => {
  it("resolves a known slug", () => {
    render(
      <ProjectConfigProvider configs={configs}>
        <Probe slug="card-block-lost" />
      </ProjectConfigProvider>,
    );
    expect(screen.getByText("Card Block")).toBeDefined();
  });

  it("returns null for an unknown slug", () => {
    render(
      <ProjectConfigProvider configs={configs}>
        <Probe slug="nope" />
      </ProjectConfigProvider>,
    );
    expect(screen.getByText("null")).toBeDefined();
  });
});
