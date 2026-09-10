import Database from "better-sqlite3";
import { loadMigrations } from "./migrate";
import type { ProjectSummary, Store, StoredProject, StoredRule, TrafficEntry, TrafficFilter } from "./types";

interface ProjectRow {
  slug: string;
  name: string;
  base_path: string | null;
  defaults: string;
  openapi_doc: string | null;
  source: "repo" | "store";
  upstream: string | null;
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

  async saveProject(p: StoredProject): Promise<void> {
    const now = new Date().toISOString();
    const tx = this.db.transaction((project: StoredProject) => {
      const existing = this.db.prepare("select config_version from project where slug = ?").get(project.slug) as
        | { config_version: number }
        | undefined;
      // Server-authoritative version: bump on every save, never trust the
      // caller's value — that is what makes "config_version monotonicity"
      // (plan 02's conformance suite) actually hold.
      const nextVersion = (existing?.config_version ?? 0) + 1;

      this.db
        .prepare(
          `insert into project (slug, name, base_path, defaults, openapi_doc, source, upstream, config_version, updated_at)
           values (@slug, @name, @basePath, @defaults, @openApiDoc, @source, @upstream, @configVersion, @updatedAt)
           on conflict(slug) do update set
             name = excluded.name, base_path = excluded.base_path, defaults = excluded.defaults,
             openapi_doc = excluded.openapi_doc, source = excluded.source, upstream = excluded.upstream,
             config_version = excluded.config_version, updated_at = excluded.updated_at`,
        )
        .run({
          slug: project.slug,
          name: project.name,
          basePath: project.basePath ?? null,
          defaults: JSON.stringify(project.defaults),
          openApiDoc: project.openApiDoc != null ? JSON.stringify(project.openApiDoc) : null,
          source: project.source,
          upstream: project.upstream != null ? JSON.stringify(project.upstream) : null,
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
    });
    tx(p);
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
            client_hash, config_version, truncated, via_upstream)
         values
           (@id, @slug, @at, @method, @path, @query, @reqHeaders, @reqBody, @status,
            @resHeaders, @resBody, @matchedRuleId, @durationMs, @warnings,
            @clientHash, @configVersion, @truncated, @viaUpstream)`,
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
      });
  }

  async queryTraffic(filter: TrafficFilter): Promise<TrafficEntry[]> {
    const limit = filter.limit ?? 50;
    const clauses = ["slug = @slug"];
    const params: Record<string, unknown> = { slug: filter.slug, limit };
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

    // since= (polling) wants oldest-first so a client appends in arrival
    // order; every other query wants newest-first.
    const order = filter.since ? "at asc" : "at desc";
    const rows = this.db
      .prepare(`select * from traffic where ${clauses.join(" and ")} order by ${order} limit @limit`)
      .all(params) as SqliteTrafficRow[];
    return rows.map(sqliteRowToTrafficEntry);
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

  async close(): Promise<void> {
    this.db.close();
  }
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
  };
}
