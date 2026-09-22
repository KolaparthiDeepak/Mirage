// Plan 24 — `npm run restore -- <backup.db> <target.db> [--force]`. Thin CLI
// wrapper around src/store/backup.ts's restoreSqlite(), which has its own
// test exercising the real mechanics — this script is just argv parsing.
import { restoreSqlite } from "../src/store/backup";

const args = process.argv.slice(2);
const force = args.includes("--force");
const [backup, target] = args.filter((a) => a !== "--force");
if (!backup || !target) {
  console.error("usage: npm run restore -- <backup.db> <target.db> [--force]");
  process.exit(1);
}

try {
  restoreSqlite(backup, target, force);
  console.log(`[restore] ${backup} -> ${target}`);
} catch (e) {
  console.error(`[restore] failed: ${(e as Error).message}`);
  process.exit(1);
}
