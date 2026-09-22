// Plan 24 — `npm run backup -- <source.db> <dest.db>`. Thin CLI wrapper
// around src/store/backup.ts's backupSqlite(), which has its own test
// exercising the real mechanics — this script is just argv parsing.
import { backupSqlite } from "../src/store/backup";

const [source, dest] = process.argv.slice(2);
if (!source || !dest) {
  console.error("usage: npm run backup -- <source.db> <dest.db>");
  process.exit(1);
}

try {
  await backupSqlite(source, dest);
  console.log(`[backup] ${source} -> ${dest}`);
} catch (e) {
  console.error(`[backup] failed: ${(e as Error).message}`);
  process.exit(1);
}
