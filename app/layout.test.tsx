import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, "./layout.tsx"), "utf8");

describe("root layout", () => {
  it("loads Inter and JetBrains Mono from next/font/google", () => {
    expect(src).toMatch(/from "next\/font\/google"/);
    expect(src).toMatch(/Inter\(/);
    expect(src).toMatch(/JetBrains_Mono\(/);
  });
  it("exposes them as --font-inter / --font-jetbrains", () => {
    expect(src).toMatch(/--font-inter/);
    expect(src).toMatch(/--font-jetbrains/);
  });
  it("keeps the pre-paint theme script", () => {
    expect(src).toMatch(/localStorage\.getItem\('mockservers-theme'\)/);
  });
});
