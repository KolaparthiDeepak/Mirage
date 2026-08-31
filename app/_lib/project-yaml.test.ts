import { describe, it, expect } from "vitest";
import { parse } from "yaml";
import { projectYaml } from "./project-yaml";

describe("projectYaml", () => {
  it("emits only the keys GeneralTab edits — name (quoted), slug, basePath", () => {
    const out = projectYaml({
      name: "Card Block (Lost Card)",
      slug: "card-block-lost",
      basePath: "/commands",
    });
    expect(out).toBe(
      `name: "Card Block (Lost Card)"
slug: card-block-lost
basePath: /commands
`,
    );
    expect(out).not.toContain("defaults");
  });

  it("omits the basePath line when basePath is empty or undefined", () => {
    const out = projectYaml({ name: "Thing", slug: "thing" });
    expect(out).toBe(`name: "Thing"\nslug: thing\n`);
    expect(projectYaml({ name: "Thing", slug: "thing", basePath: "" })).toBe(out);
  });

  it("escapes a name with a colon, hash or quote so it stays a string", () => {
    expect(parse(projectYaml({ name: "Cards: v2", slug: "c" })).name).toBe(
      "Cards: v2",
    );
    expect(parse(projectYaml({ name: 'a "b" c', slug: "c" })).name).toBe(
      'a "b" c',
    );
  });
});
