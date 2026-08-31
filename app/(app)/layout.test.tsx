import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, it, expect } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const layout = readFileSync(join(__dirname, "./layout.tsx"), "utf8");
const page = readFileSync(join(__dirname, "../page.tsx"), "utf8");

describe("(app) shell wiring", () => {
  it("builds the ViewModel once in the layout and mounts the providers", () => {
    expect(layout).toMatch(/buildViewModel/);
    expect(layout).toMatch(/ViewModelProvider/);
    expect(layout).toMatch(/PreviewProvider/);
    expect(layout).toMatch(/AppShell/);
  });
  it("root page redirects to /projects", () => {
    expect(page).toMatch(/redirect\("\/projects"\)/);
  });
});
