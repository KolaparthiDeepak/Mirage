#!/usr/bin/env node
// Plan 19 — works today inside this workspace checkout via tsx (already a
// root devDependency); does NOT work as a standalone `npm install -g` /
// `npx` package yet, because there is no build step compiling src/cli.ts (and
// the main app's src/compile/* it imports) to plain JS. That build, and the
// actual `npm publish`, are explicitly deferred — see packages/cli/README.md.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const entry = join(here, "..", "src", "cli.ts");

const result = spawnSync(process.execPath, ["--import", "tsx/esm", entry, ...process.argv.slice(2)], {
  stdio: "inherit",
});
process.exit(result.status ?? 1);
