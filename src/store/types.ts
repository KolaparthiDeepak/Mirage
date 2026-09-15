import type { Rule } from "../compile/schema";
import type { ContractConfig, DocsConfig, FaultsConfig, MockResponse, ProjectVariable, UpstreamConfig } from "../engine/types";

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
  /** Plan 17. Shared project variables; `{{vars.key}}` resolves from these. */
  variables?: ProjectVariable[];
  defaultEnvironment?: string;
  /** Plan 13. */
  contract?: ContractConfig;
  /** Plan 18. Absent/enabled:false means the /d/:slug docs page 404s. */
  docs?: DocsConfig;
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

/** Plan 15 — one append-only history row. `before`/`after` hold the rule
 *  definition (or the project meta) as it was / became. */
export interface ConfigEvent {
  id: number;
  slug: string;
  at: string; // ISO-8601
  actor: string | null;
  kind: "project.update" | "rule.create" | "rule.update" | "rule.delete" | "rule.reorder" | "import" | "revert";
  targetId: string | null;
  before: unknown | null;
  after: unknown | null;
  version: number;
}

/** The parts a caller supplies; id/at/version are set by the store. */
export type ConfigEventInput = Omit<ConfigEvent, "id" | "at" | "version">;

/** Plan 21 — a saved traffic filter, pinned to the project's traffic page.
 *  `query` is a subset of TrafficFilter's shape (validated by
 *  src/views/schema.ts at the API boundary — opaque here, like a rule's
 *  `definition`). */
export interface StoredView {
  id: string;
  slug: string;
  name: string;
  query: Record<string, unknown>;
  createdAt: string;
}

/** Plan 21 — a saved view plus a threshold plus a destination. Evaluation
 *  state (last fired/recovered/error, currently firing) lives on the same
 *  row: the cron sweep and the Test button read and write through one
 *  source of truth, never two. */
export interface StoredAlert {
  id: string;
  slug: string;
  name: string;
  /** A built-in view id ("unmatched" | "errors" | "slow") or a StoredView id. */
  view: string;
  condition:
    | { kind: "unmatched"; gt: number; windowMinutes: number }
    | { kind: "errorRate"; gt: number; windowMinutes: number }
    | { kind: "silence"; windowMinutes: number };
  notify: { webhook?: string; slack?: string; discord?: string };
  cooldownMinutes: number;
  enabled: boolean;
  lastFiredAt: string | null;
  lastRecoveredAt: string | null;
  lastError: string | null;
  currentlyFiring: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Plan 16 — a saved flow definition. `definition` is `flowSchema`'s shape. */
export interface StoredFlow {
  id: string;
  slug: string;
  name: string;
  definition: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface FlowRun {
  id: string;
  slug: string;
  flowId: string;
  startedAt: string;
  finishedAt: string | null;
  status: "running" | "passed" | "failed" | "error";
  /** Per-step results — StepResult[] from src/flows/run.ts, opaque to the store. */
  results: unknown[];
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
  /** Plan 21 "Slow" saved view: only rows at or above this duration. */
  durationMsFrom?: number;
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
   *  simplest correct primitive for now. Plan 15: pass `event` to write a
   *  history row in the SAME transaction — a change with no event is a change
   *  nobody can undo, so this is part of the contract, not fire-and-forget. */
  saveProject(p: StoredProject, event?: ConfigEventInput): Promise<void>;
  /** Plan 15: reverse-chronological history for a project. */
  listConfigEvents(slug: string, opts?: { limit?: number; before?: string; targetId?: string }): Promise<ConfigEvent[]>;
  getConfigEvent(slug: string, id: number): Promise<ConfigEvent | null>;
  /** Retention: keep the newest `keep` per project OR everything since
   *  `since`, whichever is larger. Returns rows deleted. */
  pruneConfigEvents(slug: string, keep: number, since: Date): Promise<number>;

  /** Plan 16 — flows. */
  saveFlow(flow: StoredFlow): Promise<void>;
  getFlow(slug: string, id: string): Promise<StoredFlow | null>;
  listFlows(slug: string): Promise<StoredFlow[]>;
  deleteFlow(slug: string, id: string): Promise<void>;
  saveFlowRun(run: FlowRun): Promise<void>;
  getFlowRun(slug: string, runId: string): Promise<FlowRun | null>;
  listFlowRuns(slug: string, flowId: string, limit?: number): Promise<FlowRun[]>;
  /** Retention: 30 days, per plan. Returns rows deleted. */
  pruneFlowRuns(before: Date): Promise<number>;

  /** Plan 21 — saved views. */
  saveView(view: StoredView): Promise<void>;
  getView(slug: string, id: string): Promise<StoredView | null>;
  listViews(slug: string): Promise<StoredView[]>;
  deleteView(slug: string, id: string): Promise<void>;

  /** Plan 21 — alerts. */
  saveAlert(alert: StoredAlert): Promise<void>;
  getAlert(slug: string, id: string): Promise<StoredAlert | null>;
  listAlerts(slug: string): Promise<StoredAlert[]>;
  /** Every enabled alert across every project — the cron sweep's one query
   *  of entry, bounded by the 10-per-project cap enforced at save. */
  listAllEnabledAlerts(): Promise<StoredAlert[]>;
  deleteAlert(slug: string, id: string): Promise<void>;
  /** Evaluation-state-only update, so the cron sweep never has to re-supply
   *  the alert's own config to record a firing. The evaluator always knows
   *  the full new state, so this takes all four fields rather than a partial
   *  patch — no "which fields were omitted" ambiguity to get wrong. */
  updateAlertState(
    slug: string,
    id: string,
    state: Pick<StoredAlert, "lastFiredAt" | "lastRecoveredAt" | "lastError" | "currentlyFiring">,
  ): Promise<void>;
  deleteProject(slug: string): Promise<void>;
  getConfigVersion(slug: string): Promise<number | null>;

  /** Never throws in a way that should reach the caller's response — plan 04
   *  rule 2: "a failed write is logged and swallowed." The *caller* (the mock
   *  route) is responsible for the try/catch; the store method itself is
   *  allowed to throw so tests can observe a failure, but production call
   *  sites must never await this without a catch. */
  recordTraffic(entry: TrafficEntry): Promise<void>;
  queryTraffic(filter: TrafficFilter): Promise<TrafficEntry[]>;
  /** Plan 21 — a saved view's live count badge. Same filter shape as
   *  queryTraffic, an actual COUNT rather than fetching rows to measure them. */
  countTraffic(filter: TrafficFilter): Promise<number>;
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
