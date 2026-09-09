import type { Rule } from "../compile/schema";
import type { MockResponse } from "../engine/types";

/** Project metadata as stored — everything compileMocks() would read from
 *  project.yaml, plus the bookkeeping fields the store adds. */
export interface StoredProjectMeta {
  slug: string;
  name: string;
  basePath?: string;
  defaults: { delayMs: number; cors: boolean; notFound: MockResponse };
  openApiDoc?: unknown;
  /** "repo": mirrored from mocks/**, read-only in the UI, one writer (sync-cli).
   *  "store": created and edited directly. See plan 02 and plan 03. */
  source: "repo" | "store";
  configVersion: number;
  updatedAt: string; // ISO-8601
}

/** One rule exactly as ruleSchema validates it (pre-compile — no `segments`,
 *  no precompiled regex). Compiling into a runtime Route happens above the
 *  store, in the config cache, not here. */
export interface StoredRule {
  ruleId: string;
  /** First-match-wins order. Explicit and reorderable, unlike the filename +
   *  array-order the file workflow relies on. */
  position: number;
  definition: Rule;
}

export interface StoredProject extends StoredProjectMeta {
  /** Ordered by `position` ascending. */
  rules: StoredRule[];
}

export interface ProjectSummary {
  slug: string;
  name: string;
  source: "repo" | "store";
  ruleCount: number;
  configVersion: number;
  updatedAt: string;
}

/**
 * Config-side surface only (plan 02's rollout step 1). Traffic (plan 04) and
 * counters (plan 10) are added to this interface when those plans are actually
 * built — an interface method nobody has implemented yet is worse than no
 * method: it invites a caller to depend on something that throws.
 */
export interface Store {
  getProject(slug: string): Promise<StoredProject | null>;
  listProjects(): Promise<ProjectSummary[]>;
  /** Upserts the project row and replaces its full rule set atomically —
   *  simplest correct primitive for now. Plan 03's incremental per-rule
   *  endpoints (create/update/delete one rule, reorder) can be added when that
   *  plan is actually built, without changing this method's contract. */
  saveProject(p: StoredProject): Promise<void>;
  deleteProject(slug: string): Promise<void>;
  getConfigVersion(slug: string): Promise<number | null>;
  /** Releases the underlying connection/handle. Every driver and every test
   *  must call this when done — a leaked SQLite file handle fails Windows CI,
   *  a leaked Postgres connection exhausts the pool. */
  close(): Promise<void>;
}
