import { describe, it, expect } from "vitest";
import { parse } from "yaml";
import { projectYaml } from "./project-yaml";

describe("projectYaml", () => {
  it("emits only the keys GeneralTab edits — name, slug, basePath, all quoted scalars", () => {
    const out = projectYaml({
      name: "Card Block (Lost Card)",
      slug: "card-block-lost",
      basePath: "/commands",
    });
    expect(out).toBe(
      `name: "Card Block (Lost Card)"
slug: "card-block-lost"
basePath: "/commands"
`,
    );
    expect(out).not.toContain("defaults");
  });

  it("omits the basePath line when basePath is empty or undefined", () => {
    const out = projectYaml({ name: "Thing", slug: "thing" });
    expect(out).toBe(`name: "Thing"\nslug: "thing"\n`);
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

  it("escapes a basePath with a newline or quote — no injected keys", () => {
    const out = projectYaml({
      name: "X",
      slug: "x",
      basePath: '/a\nname: injected\n"evil',
    });
    const doc = parse(out);
    expect(doc.basePath).toBe('/a\nname: injected\n"evil');
    expect(doc.name).toBe("X");
    expect(Object.keys(doc)).toEqual(["name", "slug", "basePath"]);
  });

  it("escapes a slug with YAML metacharacters", () => {
    const out = projectYaml({ name: "X", slug: "&anchor: *ref" });
    expect(parse(out).slug).toBe("&anchor: *ref");
  });
});
