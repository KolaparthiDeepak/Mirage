import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";

const css = readFileSync(new URL("../tokens.css", import.meta.url), "utf8");

describe("tokens.css", () => {
  it("defines the Obsidian palette on :root verbatim from the spec", () => {
    for (const [name, hex] of [
      ["--bg", "#0B0C0F"], ["--surface", "#111318"], ["--surface-elevated", "#17191F"],
      ["--border", "#252831"], ["--text", "#F5F5F2"], ["--text-secondary", "#8B909B"],
      ["--text-muted", "#626773"], ["--accent", "#A78BFA"], ["--accent-hover", "#B59AFB"],
      ["--success", "#46C88A"], ["--warning", "#E8B85C"], ["--error", "#EF6B73"], ["--info", "#6EA8FE"],
    ]) {
      expect(css).toMatch(new RegExp(`${name}\\s*:\\s*${hex}`, "i"));
    }
  });
  it("defines a paper (light) theme override", () => {
    expect(css).toMatch(/:root\[data-theme="paper"\]/);
  });
  it("zeroes transitions under reduced motion", () => {
    expect(css).toMatch(/prefers-reduced-motion/);
  });
});
