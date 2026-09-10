import type { Rule } from "../compile/schema";
import type { FaultsConfig, MockResponse, UpstreamConfig } from "../engine/types";

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
  /** Plan 07. Absent means "no upstream" — same as `{ mode: "off" }`. */
  upstream?: UpstreamConfig;
  /** Plan 11. Absent or `enabled:false` means "no faults". */
  faults?: FaultsConfig;
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

/** One recorded request/response (plan 04). Redacted and truncated by the
 *  caller (src/store/redact.ts, src/store/traffic-limits.ts) before it ever
 *  reaches a Store method — the store persists exactly what it is given. */
export interface TrafficEntry {
  id: string;
  slug: string;
  at: string; // ISO-8601
  method: string;
  path: string;
  query: Record<string, string>;
  reqHeaders: Record<string, string>;
  reqBody: string | null;
  status: number;
  resHeaders: Record<string, string>;
  resBody: string | null;
  matchedRuleId: string | null;
  durationMs: number;
  warnings: string[];
  clientHash: string | null;
  configVersion: number | null;
  truncated: boolean;
  /** Plan 07: this exchange was served by the project's upstream, not a rule. */
  viaUpstream: boolean;
  /** Plan 12: "outbound" for a callback Mirage sent; "inbound" for a request
   *  it received (the default). */
  direction: "inbound" | "outbound";
}

export interface TrafficFilter {
  slug: string;
  /** Exact id — for the detail view and the match-trace endpoint (plan 06). */
  id?: string;
  /** Defaults to a small page — callers page explicitly via `before`. */
  limit?: number;
  /** Only rows strictly older than this ISO timestamp — cursor pagination by
   *  `at`, newest-first. */
  before?: string;
  /** Only rows strictly newer than this ISO timestamp — the live tail's poll
   *  cursor (plan 05). Combining with `before` is meaningless and not used. */
  since?: string;
  /** true: only unmatched rows (the plan 05 "unmatched inbox"); false: only
   *  matched; omitted: both. */
  unmatchedOnly?: boolean;
  /** Plan 07 "Recordings" view: only rows served by the upstream. */
  viaUpstreamOnly?: boolean;
  method?: string;
  ruleId?: string;
  /** Case-sensitive substring match on `path`. */
  pathContains?: string;
  /** Inclusive status range — e.g. 500/599 for the 5xx class. */
  statusFrom?: number;
  statusTo?: number;
}

/**
 * Config-side surface (plan 02) plus traffic (plan 04). Counters (plan 10)
 * are added when that plan is actually built — an interface method nobody has
 * implemented yet is worse than no method: it invites a caller to depend on
 * something that throws.
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

  /** Never throws in a way that should reach the caller's response — plan 04
   *  rule 2: "a failed write is logged and swallowed." The *caller* (the mock
   *  route) is responsible for the try/catch; the store method itself is
   *  allowed to throw so tests can observe a failure, but production call
   *  sites must never await this without a catch. */
  recordTraffic(entry: TrafficEntry): Promise<void>;
  queryTraffic(filter: TrafficFilter): Promise<TrafficEntry[]>;
  /** Deletes rows older than `before` OR beyond `maxRowsPerProject` per slug
   *  (keeping the newest), whichever is more aggressive — plan 04: "keeps one
   *  noisy project from evicting a quiet one." Returns the number deleted. */
  pruneTraffic(before: Date, maxRowsPerProject: number): Promise<number>;

  /** Plan 10: atomic increment of the (slug, ruleId, session) call counter,
   *  returning the post-increment value (1 on the first call). A single
   *  `insert ... on conflict do update` — correct under concurrency. */
  bumpCounter(slug: string, ruleId: string, session: string): Promise<number>;
  /** Zeroes counters. Omit ruleId/session to widen the scope: (slug) resets
   *  the whole project, (slug, ruleId) one rule, all three one session.
   *  Returns the number of counter rows removed. */
  resetCounters(slug: string, ruleId?: string, session?: string): Promise<number>;
  /** TTL sweep — deletes counters idle since before `cutoff`. */
  pruneCounters(cutoff: Date): Promise<number>;

  /** Releases the underlying connection/handle. Every driver and every test
   *  must call this when done — a leaked SQLite file handle fails Windows CI,
   *  a leaked Postgres connection exhausts the pool. */
  close(): Promise<void>;
}
