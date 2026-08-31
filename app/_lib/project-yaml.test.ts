import { describe, it, expect } from "vitest";
import { projectYaml } from "./project-yaml";

describe("projectYaml", () => {
  it("emits name, slug, basePath and default block", () => {
    expect(
      projectYaml({
        name: "Card Block (Lost Card)",
        slug: "card-block-lost",
        basePath: "/commands",
      }),
    ).toBe(
      `name: Card Block (Lost Card)
slug: card-block-lost
basePath: /commands
defaults:
  delayMs: 0
  cors: true
`,
    );
  });

  it("omits the basePath line when basePath is empty or undefined", () => {
    const out = projectYaml({ name: "Thing", slug: "thing" });
    expect(out).toBe(
      `name: Thing
slug: thing
defaults:
  delayMs: 0
  cors: true
`,
    );
    expect(projectYaml({ name: "Thing", slug: "thing", basePath: "" })).toBe(out);
  });

  it("quotes the name when it contains a colon or hash", () => {
    expect(projectYaml({ name: "Cards: v2", slug: "c" })).toContain(
      `name: "Cards: v2"`,
    );
    expect(projectYaml({ name: "Cards #2", slug: "c" })).toContain(
      `name: "Cards #2"`,
    );
  });
});
