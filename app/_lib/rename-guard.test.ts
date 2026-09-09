// Plan 25 (rename to Mirage) risk: "a stale mockservers reference reappears
// later" is mitigated by "a grep test in CI". This is that test — scoped to
// source code, where a regression (e.g. someone reintroducing
// "mockservers-theme" as the primary storage key instead of the documented
// legacy fallback) would actually break something. Docs are exempt: the
// historical dated specs/plans correctly keep the old name as a record of what
// was true when they were written, and the current design docs discuss the old
// name deliberately while explaining the rename decision.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "..", "..");
const SCAN_DIRS = ["app", "src", "scripts"];
const SKIP_DIR_NAMES = new Set(["node_modules", ".next", "__fixtures__"]);

// Every file allowed to still mention "mockservers", and exactly why: each one
// carries a deliberate, tested legacy-compat fallback (plan 25) rather than the
// old name being the source of truth.
const ALLOWED = new Set([
  "app/_lib/theme.ts", // LEGACY_KEY fallback so an existing theme choice survives
  "app/_lib/theme.test.tsx", // asserts that fallback
  "app/layout.tsx", // inline anti-flash script checks the legacy key too
  "app/layout.test.tsx", // asserts that
  "app/_lib/preview-store.tsx", // comment explaining why *no* fallback is needed here
  "app/_lib/rename-guard.test.ts", // this file — names the old name to guard against it
]);

function listFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (SKIP_DIR_NAMES.has(name)) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...listFiles(full));
    else if (/\.(ts|tsx|mjs|js|json)$/.test(name)) out.push(full);
  }
  return out;
}

describe("rename to Mirage (plan 25)", () => {
  it("has no stray \"mockservers\" reference in source outside the documented legacy fallbacks", () => {
    const offenders: string[] = [];
    for (const dir of SCAN_DIRS) {
      for (const file of listFiles(join(ROOT, dir))) {
        const rel = file.slice(ROOT.length + 1);
        if (ALLOWED.has(rel)) continue;
        if (/mockservers/i.test(readFileSync(file, "utf8"))) offenders.push(rel);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("package.json is named mirage", () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as { name: string };
    expect(pkg.name).toBe("mirage");
  });
});
