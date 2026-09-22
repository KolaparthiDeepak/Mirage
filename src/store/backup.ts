// Plan 24 — SQLite backup/restore for self-hosted deployments. "Daily
// database snapshot ... a restore drill performed once and documented. An
// untested backup is a belief, not a backup" — so this is a library function
// with its own test (backup.test.ts, exercising the real mechanics: write
// data, back up, destroy the original, restore, verify), not just a shell
// script nobody runs until the day it matters.
//
// Uses better-sqlite3's own online backup API (db.backup()), not a plain
// file copy of the live database: SqliteStore runs in WAL mode, so a raw
// `cp` of just the main .db file can miss committed-but-not-yet-checkpointed
// writes sitting in the -wal file. db.backup() is SQLite's own
// WAL-consistent snapshot mechanism and works against a database that's
// still open and being written to, which is the actual self-host scenario
// (backing up while the container keeps serving).
import Database from "better-sqlite3";
import { copyFileSync, existsSync } from "node:fs";

/** Snapshots `sourcePath` (a live or closed SQLite database) to
 *  `destPath`, WAL-consistent, without requiring the source to be closed
 *  first. `destPath` must not already exist — a backup script overwriting
 *  yesterday's backup silently is exactly the failure mode this plan warns
 *  "an untested backup is a belief" about. */
export async function backupSqlite(sourcePath: string, destPath: string): Promise<void> {
  if (existsSync(destPath)) {
    throw new Error(`backup destination already exists: ${destPath}`);
  }
  const db = new Database(sourcePath, { readonly: true });
  try {
    await db.backup(destPath);
  } finally {
    db.close();
  }
}

/** Restores a backup produced by backupSqlite() to `targetPath`. A plain
 *  file copy is correct here (unlike the backup direction): db.backup()'s
 *  output is a complete, non-WAL, self-contained snapshot, so copying it is
 *  copying a consistent database, not a live one that could be
 *  mid-write. Refuses to overwrite an existing target unless `force`. */
export function restoreSqlite(backupPath: string, targetPath: string, force = false): void {
  if (!existsSync(backupPath)) {
    throw new Error(`backup source does not exist: ${backupPath}`);
  }
  if (existsSync(targetPath) && !force) {
    throw new Error(`restore target already exists (pass force to overwrite): ${targetPath}`);
  }
  copyFileSync(backupPath, targetPath);
}
