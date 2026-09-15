import Database from "better-sqlite3";
import { loadMigrations } from "./migrate";
import type {
  ConfigEvent,
  ConfigEventInput,
  FlowRun,
  ProjectSummary,
  Store,
  StoredAlert,
  StoredFlow,
  StoredProject,
  StoredRule,
  StoredView,
  TrafficEntry,
  TrafficFilter,
} from "./types";

interface SqliteEventRow {
  id: number;
  slug: string;
  at: string;
  actor: string | null;
  kind: ConfigEvent["kind"];
  target_id: string | null;
  before: string | null;
  after: string | null;
  version: number;
}

function sqliteRowToEvent(r: SqliteEventRow): ConfigEvent {
  return {
    id: r.id,
    slug: r.slug,
    at: r.at,
    actor: r.actor,
    kind: r.kind,
    targetId: r.target_id,
    before: r.before ? JSON.parse(r.before) : null,
    after: r.after ? JSON.parse(r.after) : null,
    version: r.version,
  };
}

interface ProjectRow {
  slug: string;
  name: string;
  base_path: string | null;
  defaults: string;
  openapi_doc: string | null;
  source: "repo" | "store";
  upstream: string | null;
  faults: string | null;
  variables: string | null;
  default_environment: string | null;
  contract: string | null;
  docs: string | null;
  config_version: number;
  updated_at: string;
}

interface RuleRow {
  rule_id: string;
  position: number;
  definition: string;
}

function rowToProject(row: ProjectRow, rules: RuleRow[]): StoredProject {
  return {
    slug: row.slug,
    name: row.name,
    basePath: row.base_path ?? undefined,
    defaults: JSON.parse(row.defaults) as StoredProject["defaults"],
    openApiDoc: row.openapi_doc ? JSON.parse(row.openapi_doc) : undefined,
    source: row.source,
    upstream: row.upstream ? (JSON.parse(row.upstream) as StoredProject["upstream"]) : undefined,
    faults: row.faults ? (JSON.parse(row.faults) as StoredProject["faults"]) : undefined,
    variables: row.variables ? (JSON.parse(row.variables) as StoredProject["variables"]) : undefined,
    defaultEnvironment: row.default_environment ?? undefined,
    contract: row.contract ? (JSON.parse(row.contract) as StoredProject["contract"]) : undefined,
    docs: row.docs ? (JSON.parse(row.docs) as StoredProject["docs"]) : undefined,
    configVersion: row.config_version,
    updatedAt: row.updated_at,
    rules: rules
      .sort((a, b) => a.position - b.position)
      .map((r): StoredRule => ({
        ruleId: r.rule_id,
        position: r.position,
        definition: JSON.parse(r.definition) as StoredRule["definition"],
      })),
  };
}

/**
 * better-sqlite3 is synchronous end to end; every Store method still returns a
 * Promise so callers (and the Postgres driver) share one async interface.
 */
export class SqliteStore implements Store {
  private db: Database.Database;

  constructor(path: string) {
    this.db = new Database(path);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    this.runMigrations();
  }

  private runMigrations(): void {
    this.db.exec(
      "create table if not exists _migrations (id text primary key, applied_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now')))",
    );
    const applied = new Set(
      this.db.prepare("select id from _migrations").all().map((r) => (r as { id: string }).id),
    );
    for (const m of loadMigrations("sqlite")) {
      if (applied.has(m.id)) continue;
      this.db.exec(m.sql);
      this.db.prepare("insert into _migrations (id) values (?)").run(m.id);
    }
  }

  async getProject(slug: string): Promise<StoredProject | null> {
    const row = this.db.prepare("select * from project where slug = ?").get(slug) as ProjectRow | undefined;
    if (!row) return null;
    const rules = this.db.prepare("select rule_id, position, definition from rule where slug = ?").all(slug) as RuleRow[];
    return rowToProject(row, rules);
  }

  async listProjects(): Promise<ProjectSummary[]> {
    const rows = this.db
      .prepare(
        `select p.slug, p.name, p.source, p.config_version, p.updated_at,
                (select count(*) from rule r where r.slug = p.slug) as rule_count
         from project p order by p.slug`,
      )
      .all() as Array<ProjectRow & { rule_count: number }>;
    return rows.map((r) => ({
      slug: r.slug,
      name: r.name,
      source: r.source,
      ruleCount: r.rule_count,
      configVersion: r.config_version,
      updatedAt: r.updated_at,
    }));
  }

  async saveProject(p: StoredProject, event?: ConfigEventInput): Promise<void> {
    const now = new Date().toISOString();
    const tx = this.db.transaction((project: StoredProject, ev?: ConfigEventInput) => {
      const existing = this.db.prepare("select config_version from project where slug = ?").get(project.slug) as
        | { config_version: number }
        | undefined;
      // Server-authoritative version: bump on every save, never trust the
      // caller's value — that is what makes "config_version monotonicity"
      // (plan 02's conformance suite) actually hold.
      const nextVersion = (existing?.config_version ?? 0) + 1;

      this.db
        .prepare(
          `insert into project (slug, name, base_path, defaults, openapi_doc, source, upstream, faults, variables, default_environment, contract, docs, config_version, updated_at)
           values (@slug, @name, @basePath, @defaults, @openApiDoc, @source, @upstream, @faults, @variables, @defaultEnvironment, @contract, @docs, @configVersion, @updatedAt)
           on conflict(slug) do update set
             name = excluded.name, base_path = excluded.base_path, defaults = excluded.defaults,
             openapi_doc = excluded.openapi_doc, source = excluded.source, upstream = excluded.upstream,
             faults = excluded.faults, variables = excluded.variables, default_environment = excluded.default_environment,
             contract = excluded.contract, docs = excluded.docs, config_version = excluded.config_version, updated_at = excluded.updated_at`,
        )
        .run({
          slug: project.slug,
          name: project.name,
          basePath: project.basePath ?? null,
          defaults: JSON.stringify(project.defaults),
          openApiDoc: project.openApiDoc != null ? JSON.stringify(project.openApiDoc) : null,
          source: project.source,
          upstream: project.upstream != null ? JSON.stringify(project.upstream) : null,
          faults: project.faults != null ? JSON.stringify(project.faults) : null,
          variables: project.variables != null ? JSON.stringify(project.variables) : null,
          defaultEnvironment: project.defaultEnvironment ?? null,
          contract: project.contract != null ? JSON.stringify(project.contract) : null,
          docs: project.docs != null ? JSON.stringify(project.docs) : null,
          configVersion: nextVersion,
          updatedAt: now,
        });

      this.db.prepare("delete from rule where slug = ?").run(project.slug);
      const insertRule = this.db.prepare(
        "insert into rule (slug, rule_id, position, definition) values (?, ?, ?, ?)",
      );
      for (const rule of project.rules) {
        insertRule.run(project.slug, rule.ruleId, rule.position, JSON.stringify(rule.definition));
      }

      if (ev) {
        this.db
          .prepare(
            `insert into config_event (slug, actor, kind, target_id, before, after, version)
             values (?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            project.slug,
            ev.actor,
            ev.kind,
            ev.targetId,
            ev.before != null ? JSON.stringify(ev.before) : null,
            ev.after != null ? JSON.stringify(ev.after) : null,
            nextVersion,
          );
      }
    });
    tx(p, event);
  }

  async listConfigEvents(
    slug: string,
    opts: { limit?: number; before?: string; targetId?: string } = {},
  ): Promise<ConfigEvent[]> {
    const clauses = ["slug = @slug"];
    const params: Record<string, unknown> = { slug, limit: opts.limit ?? 100 };
    if (opts.before) { clauses.push("at < @before"); params.before = opts.before; }
    if (opts.targetId) { clauses.push("target_id = @targetId"); params.targetId = opts.targetId; }
    const rows = this.db
      .prepare(`select * from config_event where ${clauses.join(" and ")} order by at desc, id desc limit @limit`)
      .all(params) as SqliteEventRow[];
    return rows.map(sqliteRowToEvent);
  }

  async getConfigEvent(slug: string, id: number): Promise<ConfigEvent | null> {
    const row = this.db.prepare("select * from config_event where slug = ? and id = ?").get(slug, id) as
      | SqliteEventRow
      | undefined;
    return row ? sqliteRowToEvent(row) : null;
  }

  async pruneConfigEvents(slug: string, keep: number, since: Date): Promise<number> {
    return this.db
      .prepare(
        `delete from config_event where slug = @slug and at < @since and id not in (
           select id from config_event where slug = @slug order by at desc limit @keep
         )`,
      )
      .run({ slug, since: since.toISOString(), keep }).changes;
  }

  async deleteProject(slug: string): Promise<void> {
    this.db.prepare("delete from project where slug = ?").run(slug);
  }

  async getConfigVersion(slug: string): Promise<number | null> {
    const row = this.db.prepare("select config_version from project where slug = ?").get(slug) as
      | { config_version: number }
      | undefined;
    return row?.config_version ?? null;
  }

  async recordTraffic(entry: TrafficEntry): Promise<void> {
    this.db
      .prepare(
        `insert into traffic
           (id, slug, at, method, path, query, req_headers, req_body, status,
            res_headers, res_body, matched_rule_id, duration_ms, warnings,
            client_hash, config_version, truncated, via_upstream, direction)
         values
           (@id, @slug, @at, @method, @path, @query, @reqHeaders, @reqBody, @status,
            @resHeaders, @resBody, @matchedRuleId, @durationMs, @warnings,
            @clientHash, @configVersion, @truncated, @viaUpstream, @direction)`,
      )
      .run({
        id: entry.id,
        slug: entry.slug,
        at: entry.at,
        method: entry.method,
        path: entry.path,
        query: JSON.stringify(entry.query),
        reqHeaders: JSON.stringify(entry.reqHeaders),
        reqBody: entry.reqBody,
        status: entry.status,
        resHeaders: JSON.stringify(entry.resHeaders),
        resBody: entry.resBody,
        matchedRuleId: entry.matchedRuleId,
        durationMs: entry.durationMs,
        warnings: JSON.stringify(entry.warnings),
        clientHash: entry.clientHash,
        configVersion: entry.configVersion,
        truncated: entry.truncated ? 1 : 0,
        viaUpstream: entry.viaUpstream ? 1 : 0,
        direction: entry.direction,
      });
  }

  async queryTraffic(filter: TrafficFilter): Promise<TrafficEntry[]> {
    const { clauses, params } = trafficWhere(filter);
    const limit = filter.limit ?? 50;
    params.limit = limit;

    // since= (polling) wants oldest-first so a client appends in arrival
    // order; every other query wants newest-first.
    const order = filter.since ? "at asc" : "at desc";
    const rows = this.db
      .prepare(`select * from traffic where ${clauses.join(" and ")} order by ${order} limit @limit`)
      .all(params) as SqliteTrafficRow[];
    return rows.map(sqliteRowToTrafficEntry);
  }

  /** Plan 21 — a saved view's live count badge. Same filters as queryTraffic,
   *  minus paging: a plain filtered COUNT, no windowing needed (unlike the
   *  stats endpoint's percentiles, a count doesn't need to sort a column). */
  async countTraffic(filter: TrafficFilter): Promise<number> {
    const { clauses, params } = trafficWhere(filter);
    const row = this.db.prepare(`select count(*) as n from traffic where ${clauses.join(" and ")}`).get(params) as { n: number };
    return row.n;
  }

  async pruneTraffic(before: Date, maxRowsPerProject: number): Promise<number> {
    const tx = this.db.transaction((cutoff: string, cap: number) => {
      const byAge = this.db.prepare("delete from traffic where at < ?").run(cutoff).changes;
      // Beyond the row cap, per project: delete everything past the newest `cap` rows.
      const slugs = this.db.prepare("select distinct slug from traffic").all() as Array<{ slug: string }>;
      let byCount = 0;
      for (const { slug } of slugs) {
        byCount += this.db
          .prepare(
            `delete from traffic where slug = ? and id in (
               select id from traffic where slug = ? order by at desc limit -1 offset ?
             )`,
          )
          .run(slug, slug, cap).changes;
      }
      return byAge + byCount;
    });
    return tx(before.toISOString(), maxRowsPerProject);
  }

  async bumpCounter(slug: string, ruleId: string, session: string): Promise<number> {
    const row = this.db
      .prepare(
        `insert into counter (slug, rule_id, session, n) values (?, ?, ?, 1)
         on conflict(slug, rule_id, session)
         do update set n = n + 1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
         returning n`,
      )
      .get(slug, ruleId, session) as { n: number };
    return row.n;
  }

  async resetCounters(slug: string, ruleId?: string, session?: string): Promise<number> {
    const clauses = ["slug = @slug"];
    const params: Record<string, unknown> = { slug };
    if (ruleId != null) { clauses.push("rule_id = @ruleId"); params.ruleId = ruleId; }
    if (session != null) { clauses.push("session = @session"); params.session = session; }
    return this.db.prepare(`delete from counter where ${clauses.join(" and ")}`).run(params).changes;
  }

  async pruneCounters(cutoff: Date): Promise<number> {
    return this.db.prepare("delete from counter where updated_at < ?").run(cutoff.toISOString()).changes;
  }

  async saveFlow(flow: StoredFlow): Promise<void> {
    this.db
      .prepare(
        `insert into flow (id, slug, name, definition, created_at, updated_at)
         values (@id, @slug, @name, @definition, @createdAt, @updatedAt)
         on conflict(slug, id) do update set
           name = excluded.name, definition = excluded.definition, updated_at = excluded.updated_at`,
      )
      .run({
        id: flow.id,
        slug: flow.slug,
        name: flow.name,
        definition: JSON.stringify(flow.definition),
        createdAt: flow.createdAt,
        updatedAt: flow.updatedAt,
      });
  }

  async getFlow(slug: string, id: string): Promise<StoredFlow | null> {
    const row = this.db.prepare("select * from flow where slug = ? and id = ?").get(slug, id) as SqliteFlowRow | undefined;
    return row ? sqliteRowToFlow(row) : null;
  }

  async listFlows(slug: string): Promise<StoredFlow[]> {
    const rows = this.db.prepare("select * from flow where slug = ? order by name").all(slug) as SqliteFlowRow[];
    return rows.map(sqliteRowToFlow);
  }

  async deleteFlow(slug: string, id: string): Promise<void> {
    this.db.prepare("delete from flow where slug = ? and id = ?").run(slug, id);
  }

  async saveFlowRun(run: FlowRun): Promise<void> {
    this.db
      .prepare(
        `insert into flow_run (id, slug, flow_id, started_at, finished_at, status, results)
         values (@id, @slug, @flowId, @startedAt, @finishedAt, @status, @results)
         on conflict(id) do update set
           finished_at = excluded.finished_at, status = excluded.status, results = excluded.results`,
      )
      .run({
        id: run.id,
        slug: run.slug,
        flowId: run.flowId,
        startedAt: run.startedAt,
        finishedAt: run.finishedAt,
        status: run.status,
        results: JSON.stringify(run.results),
      });
  }

  async getFlowRun(slug: string, runId: string): Promise<FlowRun | null> {
    const row = this.db.prepare("select * from flow_run where slug = ? and id = ?").get(slug, runId) as
      | SqliteFlowRunRow
      | undefined;
    return row ? sqliteRowToFlowRun(row) : null;
  }

  async listFlowRuns(slug: string, flowId: string, limit = 50): Promise<FlowRun[]> {
    const rows = this.db
      .prepare("select * from flow_run where slug = ? and flow_id = ? order by started_at desc limit ?")
      .all(slug, flowId, limit) as SqliteFlowRunRow[];
    return rows.map(sqliteRowToFlowRun);
  }

  async pruneFlowRuns(before: Date): Promise<number> {
    return this.db.prepare("delete from flow_run where started_at < ?").run(before.toISOString()).changes;
  }

  async saveView(view: StoredView): Promise<void> {
    this.db
      .prepare(
        `insert into saved_view (id, slug, name, query, created_at) values (@id, @slug, @name, @query, @createdAt)
         on conflict(slug, id) do update set name = excluded.name, query = excluded.query`,
      )
      .run({ id: view.id, slug: view.slug, name: view.name, query: JSON.stringify(view.query), createdAt: view.createdAt });
  }

  async getView(slug: string, id: string): Promise<StoredView | null> {
    const row = this.db.prepare("select * from saved_view where slug = ? and id = ?").get(slug, id) as SqliteViewRow | undefined;
    return row ? sqliteRowToView(row) : null;
  }

  async listViews(slug: string): Promise<StoredView[]> {
    const rows = this.db.prepare("select * from saved_view where slug = ? order by name").all(slug) as SqliteViewRow[];
    return rows.map(sqliteRowToView);
  }

  async deleteView(slug: string, id: string): Promise<void> {
    this.db.prepare("delete from saved_view where slug = ? and id = ?").run(slug, id);
  }

  async saveAlert(alert: StoredAlert): Promise<void> {
    this.db
      .prepare(
        `insert into alert (id, slug, name, view, condition, notify, cooldown_minutes, enabled,
           last_fired_at, last_recovered_at, last_error, currently_firing, created_at, updated_at)
         values (@id, @slug, @name, @view, @condition, @notify, @cooldownMinutes, @enabled,
           @lastFiredAt, @lastRecoveredAt, @lastError, @currentlyFiring, @createdAt, @updatedAt)
         on conflict(slug, id) do update set
           name = excluded.name, view = excluded.view, condition = excluded.condition, notify = excluded.notify,
           cooldown_minutes = excluded.cooldown_minutes, enabled = excluded.enabled, updated_at = excluded.updated_at`,
      )
      .run({
        id: alert.id,
        slug: alert.slug,
        name: alert.name,
        view: alert.view,
        condition: JSON.stringify(alert.condition),
        notify: JSON.stringify(alert.notify),
        cooldownMinutes: alert.cooldownMinutes,
        enabled: alert.enabled ? 1 : 0,
        lastFiredAt: alert.lastFiredAt,
        lastRecoveredAt: alert.lastRecoveredAt,
        lastError: alert.lastError,
        currentlyFiring: alert.currentlyFiring ? 1 : 0,
        createdAt: alert.createdAt,
        updatedAt: alert.updatedAt,
      });
  }

  async getAlert(slug: string, id: string): Promise<StoredAlert | null> {
    const row = this.db.prepare("select * from alert where slug = ? and id = ?").get(slug, id) as SqliteAlertRow | undefined;
    return row ? sqliteRowToAlert(row) : null;
  }

  async listAlerts(slug: string): Promise<StoredAlert[]> {
    const rows = this.db.prepare("select * from alert where slug = ? order by name").all(slug) as SqliteAlertRow[];
    return rows.map(sqliteRowToAlert);
  }

  async listAllEnabledAlerts(): Promise<StoredAlert[]> {
    const rows = this.db.prepare("select * from alert where enabled = 1").all() as SqliteAlertRow[];
    return rows.map(sqliteRowToAlert);
  }

  async deleteAlert(slug: string, id: string): Promise<void> {
    this.db.prepare("delete from alert where slug = ? and id = ?").run(slug, id);
  }

  async updateAlertState(
    slug: string,
    id: string,
    state: Pick<StoredAlert, "lastFiredAt" | "lastRecoveredAt" | "lastError" | "currentlyFiring">,
  ): Promise<void> {
    this.db
      .prepare(
        `update alert set last_fired_at = @lastFiredAt, last_recovered_at = @lastRecoveredAt,
           last_error = @lastError, currently_firing = @currentlyFiring
         where slug = @slug and id = @id`,
      )
      .run({
        slug,
        id,
        lastFiredAt: state.lastFiredAt,
        lastRecoveredAt: state.lastRecoveredAt,
        lastError: state.lastError,
        currentlyFiring: state.currentlyFiring ? 1 : 0,
      });
  }

  async close(): Promise<void> {
    this.db.close();
  }
}

interface SqliteFlowRow {
  id: string;
  slug: string;
  name: string;
  definition: string;
  created_at: string;
  updated_at: string;
}

function sqliteRowToFlow(r: SqliteFlowRow): StoredFlow {
  return { id: r.id, slug: r.slug, name: r.name, definition: JSON.parse(r.definition), createdAt: r.created_at, updatedAt: r.updated_at };
}

interface SqliteFlowRunRow {
  id: string;
  slug: string;
  flow_id: string;
  started_at: string;
  finished_at: string | null;
  status: FlowRun["status"];
  results: string;
}

function sqliteRowToFlowRun(r: SqliteFlowRunRow): FlowRun {
  return {
    id: r.id,
    slug: r.slug,
    flowId: r.flow_id,
    startedAt: r.started_at,
    finishedAt: r.finished_at,
    status: r.status,
    results: JSON.parse(r.results),
  };
}

interface SqliteViewRow {
  id: string;
  slug: string;
  name: string;
  query: string;
  created_at: string;
}

function sqliteRowToView(r: SqliteViewRow): StoredView {
  return { id: r.id, slug: r.slug, name: r.name, query: JSON.parse(r.query), createdAt: r.created_at };
}

interface SqliteAlertRow {
  id: string;
  slug: string;
  name: string;
  view: string;
  condition: string;
  notify: string;
  cooldown_minutes: number;
  enabled: number;
  last_fired_at: string | null;
  last_recovered_at: string | null;
  last_error: string | null;
  currently_firing: number;
  created_at: string;
  updated_at: string;
}

function sqliteRowToAlert(r: SqliteAlertRow): StoredAlert {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    view: r.view,
    condition: JSON.parse(r.condition),
    notify: JSON.parse(r.notify),
    cooldownMinutes: r.cooldown_minutes,
    enabled: r.enabled === 1,
    lastFiredAt: r.last_fired_at,
    lastRecoveredAt: r.last_recovered_at,
    lastError: r.last_error,
    currentlyFiring: r.currently_firing === 1,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/** Shared by queryTraffic and countTraffic (plan 21) — one implementation of
 *  "which rows does this filter mean", so a saved view's count can never
 *  silently disagree with the list it's counting. */
function trafficWhere(filter: TrafficFilter): { clauses: string[]; params: Record<string, unknown> } {
  const clauses = ["slug = @slug"];
  const params: Record<string, unknown> = { slug: filter.slug };
  if (filter.id) { clauses.push("id = @id"); params.id = filter.id; }
  if (filter.before) { clauses.push("at < @before"); params.before = filter.before; }
  if (filter.since) { clauses.push("at > @since"); params.since = filter.since; }
  if (filter.unmatchedOnly === true) clauses.push("matched_rule_id is null");
  else if (filter.unmatchedOnly === false) clauses.push("matched_rule_id is not null");
  if (filter.viaUpstreamOnly === true) clauses.push("via_upstream = 1");
  if (filter.method) { clauses.push("method = @method"); params.method = filter.method; }
  if (filter.ruleId) { clauses.push("matched_rule_id = @ruleId"); params.ruleId = filter.ruleId; }
  if (filter.pathContains) { clauses.push("path like @pathContains"); params.pathContains = `%${filter.pathContains}%`; }
  if (filter.statusFrom != null) { clauses.push("status >= @statusFrom"); params.statusFrom = filter.statusFrom; }
  if (filter.statusTo != null) { clauses.push("status <= @statusTo"); params.statusTo = filter.statusTo; }
  if (filter.durationMsFrom != null) { clauses.push("duration_ms >= @durationMsFrom"); params.durationMsFrom = filter.durationMsFrom; }
  return { clauses, params };
}

interface SqliteTrafficRow {
  id: string;
  slug: string;
  at: string;
  method: string;
  path: string;
  query: string;
  req_headers: string;
  req_body: string | null;
  status: number;
  res_headers: string;
  res_body: string | null;
  matched_rule_id: string | null;
  duration_ms: number;
  warnings: string;
  client_hash: string | null;
  config_version: number | null;
  truncated: number;
  via_upstream: number;
  direction: "inbound" | "outbound";
}

function sqliteRowToTrafficEntry(row: SqliteTrafficRow): TrafficEntry {
  return {
    id: row.id,
    slug: row.slug,
    at: row.at,
    method: row.method,
    path: row.path,
    query: JSON.parse(row.query),
    reqHeaders: JSON.parse(row.req_headers),
    reqBody: row.req_body,
    status: row.status,
    resHeaders: JSON.parse(row.res_headers),
    resBody: row.res_body,
    matchedRuleId: row.matched_rule_id,
    durationMs: row.duration_ms,
    warnings: JSON.parse(row.warnings),
    clientHash: row.client_hash,
    configVersion: row.config_version,
    truncated: row.truncated === 1,
    viaUpstream: row.via_upstream === 1,
    direction: row.direction ?? "inbound",
  };
}
