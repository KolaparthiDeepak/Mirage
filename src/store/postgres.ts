import postgres, { type Sql } from "postgres";
import { loadMigrations } from "./migrate";
import type { ProjectSummary, Store, StoredProject, StoredRule, TrafficEntry, TrafficFilter } from "./types";

// The stored types (StoredProject["defaults"], Rule, unknown openApiDoc) are
// plain JSON-safe data, but postgres.js's JSONValue type structurally rejects
// any interface without an index signature. A stringify/parse round-trip is
// the actual jsonb storage semantics anyway (it also strips `undefined`), so
// it is a correct cast, not just a type-checker workaround.
function toJsonb(value: unknown): postgres.JSONValue {
  return JSON.parse(JSON.stringify(value)) as postgres.JSONValue;
}

interface ProjectRow {
  slug: string;
  name: string;
  base_path: string | null;
  // jsonb columns come back already parsed by postgres.js — unlike the SQLite
  // driver, which stores JSON as text and parses it itself.
  defaults: StoredProject["defaults"];
  openapi_doc: unknown;
  source: "repo" | "store";
  upstream: StoredProject["upstream"] | null;
  faults: StoredProject["faults"] | null;
  variables: StoredProject["variables"] | null;
  default_environment: string | null;
  config_version: number;
  updated_at: string;
}

interface RuleRow {
  rule_id: string;
  position: number;
  definition: StoredRule["definition"];
}

function rowToProject(row: ProjectRow, rules: RuleRow[]): StoredProject {
  return {
    slug: row.slug,
    name: row.name,
    basePath: row.base_path ?? undefined,
    defaults: row.defaults,
    openApiDoc: row.openapi_doc ?? undefined,
    source: row.source,
    upstream: row.upstream ?? undefined,
    faults: row.faults ?? undefined,
    variables: row.variables ?? undefined,
    defaultEnvironment: row.default_environment ?? undefined,
    configVersion: Number(row.config_version),
    updatedAt: new Date(row.updated_at).toISOString(),
    rules: [...rules]
      .sort((a, b) => a.position - b.position)
      .map((r): StoredRule => ({ ruleId: r.rule_id, position: r.position, definition: r.definition })),
  };
}

/**
 * Targets Supabase Postgres over the Supavisor transaction-mode pooler (design
 * doc §8.1): a small `max` pool size and no session-level features, so a
 * serverless function never holds a connection open longer than one request.
 */
export class PostgresStore implements Store {
  private sql: Sql;
  private ready: Promise<void>;

  constructor(connectionString: string) {
    this.sql = postgres(connectionString, { max: 5 });
    this.ready = this.runMigrations();
  }

  private async runMigrations(): Promise<void> {
    await this.sql`create table if not exists _migrations (id text primary key, applied_at timestamptz not null default now())`;
    const appliedRows = await this.sql<{ id: string }[]>`select id from _migrations`;
    const applied = new Set(appliedRows.map((r) => r.id));
    for (const m of loadMigrations("postgres")) {
      if (applied.has(m.id)) continue;
      await this.sql.unsafe(m.sql);
      await this.sql`insert into _migrations (id) values (${m.id})`;
    }
  }

  async getProject(slug: string): Promise<StoredProject | null> {
    await this.ready;
    const rows = await this.sql<ProjectRow[]>`select * from project where slug = ${slug}`;
    const row = rows[0];
    if (!row) return null;
    const rules = await this.sql<
      RuleRow[]
    >`select rule_id, position, definition from rule where slug = ${slug}`;
    return rowToProject(row, rules);
  }

  async listProjects(): Promise<ProjectSummary[]> {
    await this.ready;
    const rows = await this.sql<Array<ProjectRow & { rule_count: number }>>`
      select p.slug, p.name, p.source, p.config_version, p.updated_at,
             (select count(*)::int from rule r where r.slug = p.slug) as rule_count
      from project p order by p.slug
    `;
    return rows.map((r) => ({
      slug: r.slug,
      name: r.name,
      source: r.source,
      ruleCount: r.rule_count,
      configVersion: Number(r.config_version),
      updatedAt: new Date(r.updated_at).toISOString(),
    }));
  }

  async saveProject(p: StoredProject): Promise<void> {
    await this.ready;
    await this.sql.begin(async (tx) => {
      const existing = await tx<{ config_version: number }[]>`
        select config_version from project where slug = ${p.slug}
      `;
      // Server-authoritative version: bump on every save, never trust the
      // caller's value — mirrors the SQLite driver so both pass the same
      // "config_version monotonicity" conformance test.
      const nextVersion = (existing[0] ? Number(existing[0].config_version) : 0) + 1;

      await tx`
        insert into project (slug, name, base_path, defaults, openapi_doc, source, upstream, faults, variables, default_environment, config_version, updated_at)
        values (
          ${p.slug}, ${p.name}, ${p.basePath ?? null}, ${tx.json(toJsonb(p.defaults))},
          ${p.openApiDoc != null ? tx.json(toJsonb(p.openApiDoc)) : null}, ${p.source},
          ${p.upstream != null ? tx.json(toJsonb(p.upstream)) : null},
          ${p.faults != null ? tx.json(toJsonb(p.faults)) : null},
          ${p.variables != null ? tx.json(toJsonb(p.variables)) : null}, ${p.defaultEnvironment ?? null}, ${nextVersion}, now()
        )
        on conflict (slug) do update set
          name = excluded.name, base_path = excluded.base_path, defaults = excluded.defaults,
          openapi_doc = excluded.openapi_doc, source = excluded.source, upstream = excluded.upstream,
          faults = excluded.faults, variables = excluded.variables, default_environment = excluded.default_environment,
          config_version = excluded.config_version, updated_at = excluded.updated_at
      `;

      await tx`delete from rule where slug = ${p.slug}`;
      for (const rule of p.rules) {
        await tx`
          insert into rule (slug, rule_id, position, definition)
          values (${p.slug}, ${rule.ruleId}, ${rule.position}, ${tx.json(toJsonb(rule.definition))})
        `;
      }
    });
  }

  async deleteProject(slug: string): Promise<void> {
    await this.ready;
    await this.sql`delete from project where slug = ${slug}`;
  }

  async getConfigVersion(slug: string): Promise<number | null> {
    await this.ready;
    const rows = await this.sql<{ config_version: number }[]>`
      select config_version from project where slug = ${slug}
    `;
    return rows[0] ? Number(rows[0].config_version) : null;
  }

  async recordTraffic(entry: TrafficEntry): Promise<void> {
    await this.ready;
    await this.sql`
      insert into traffic
        (id, slug, at, method, path, query, req_headers, req_body, status,
         res_headers, res_body, matched_rule_id, duration_ms, warnings,
         client_hash, config_version, truncated, via_upstream, direction)
      values (
        ${entry.id}, ${entry.slug}, ${entry.at}, ${entry.method}, ${entry.path},
        ${this.sql.json(toJsonb(entry.query))}, ${this.sql.json(toJsonb(entry.reqHeaders))}, ${entry.reqBody}, ${entry.status},
        ${this.sql.json(toJsonb(entry.resHeaders))}, ${entry.resBody}, ${entry.matchedRuleId}, ${entry.durationMs},
        ${this.sql.json(toJsonb(entry.warnings))}, ${entry.clientHash}, ${entry.configVersion}, ${entry.truncated}, ${entry.viaUpstream}, ${entry.direction}
      )
    `;
  }

  async queryTraffic(filter: TrafficFilter): Promise<TrafficEntry[]> {
    await this.ready;
    const limit = filter.limit ?? 50;
    // since= (polling) wants oldest-first so a client appends in arrival
    // order; every other query wants newest-first.
    const order = filter.since ? this.sql`order by at asc` : this.sql`order by at desc`;
    const rows = await this.sql<PgTrafficRow[]>`
      select * from traffic
      where slug = ${filter.slug}
        ${filter.id ? this.sql`and id = ${filter.id}` : this.sql``}
        ${filter.before ? this.sql`and at < ${filter.before}` : this.sql``}
        ${filter.since ? this.sql`and at > ${filter.since}` : this.sql``}
        ${filter.unmatchedOnly === true ? this.sql`and matched_rule_id is null` : this.sql``}
        ${filter.unmatchedOnly === false ? this.sql`and matched_rule_id is not null` : this.sql``}
        ${filter.viaUpstreamOnly === true ? this.sql`and via_upstream = true` : this.sql``}
        ${filter.method ? this.sql`and method = ${filter.method}` : this.sql``}
        ${filter.ruleId ? this.sql`and matched_rule_id = ${filter.ruleId}` : this.sql``}
        ${filter.pathContains ? this.sql`and path like ${"%" + filter.pathContains + "%"}` : this.sql``}
        ${filter.statusFrom != null ? this.sql`and status >= ${filter.statusFrom}` : this.sql``}
        ${filter.statusTo != null ? this.sql`and status <= ${filter.statusTo}` : this.sql``}
      ${order}
      limit ${limit}
    `;
    return rows.map(pgRowToTrafficEntry);
  }

  async pruneTraffic(before: Date, maxRowsPerProject: number): Promise<number> {
    await this.ready;
    return this.sql.begin(async (tx) => {
      const byAge = await tx`delete from traffic where at < ${before.toISOString()}`;
      // Beyond the row cap, per project: delete everything past the newest N rows.
      const byCount = await tx`
        delete from traffic t using (
          select id, row_number() over (partition by slug order by at desc) as rn
          from traffic
        ) ranked
        where t.id = ranked.id and ranked.rn > ${maxRowsPerProject}
      `;
      return byAge.count + byCount.count;
    });
  }

  async bumpCounter(slug: string, ruleId: string, session: string): Promise<number> {
    await this.ready;
    const rows = await this.sql<{ n: number }[]>`
      insert into counter (slug, rule_id, session, n) values (${slug}, ${ruleId}, ${session}, 1)
      on conflict (slug, rule_id, session)
      do update set n = counter.n + 1, updated_at = now()
      returning n
    `;
    return Number(rows[0]!.n);
  }

  async resetCounters(slug: string, ruleId?: string, session?: string): Promise<number> {
    await this.ready;
    const res = await this.sql`
      delete from counter
      where slug = ${slug}
        ${ruleId != null ? this.sql`and rule_id = ${ruleId}` : this.sql``}
        ${session != null ? this.sql`and session = ${session}` : this.sql``}
    `;
    return res.count;
  }

  async pruneCounters(cutoff: Date): Promise<number> {
    await this.ready;
    const res = await this.sql`delete from counter where updated_at < ${cutoff.toISOString()}`;
    return res.count;
  }

  async close(): Promise<void> {
    await this.sql.end();
  }
}

interface PgTrafficRow {
  id: string;
  slug: string;
  at: string;
  method: string;
  path: string;
  query: Record<string, string>;
  req_headers: Record<string, string>;
  req_body: string | null;
  status: number;
  res_headers: Record<string, string>;
  res_body: string | null;
  matched_rule_id: string | null;
  duration_ms: number;
  warnings: string[];
  client_hash: string | null;
  config_version: number | null;
  truncated: boolean;
  via_upstream: boolean;
  direction: "inbound" | "outbound";
}

function pgRowToTrafficEntry(row: PgTrafficRow): TrafficEntry {
  return {
    id: row.id,
    slug: row.slug,
    at: new Date(row.at).toISOString(),
    method: row.method,
    path: row.path,
    query: row.query,
    reqHeaders: row.req_headers,
    reqBody: row.req_body,
    status: row.status,
    resHeaders: row.res_headers,
    resBody: row.res_body,
    matchedRuleId: row.matched_rule_id,
    durationMs: row.duration_ms,
    warnings: row.warnings,
    clientHash: row.client_hash,
    configVersion: row.config_version != null ? Number(row.config_version) : null,
    truncated: row.truncated,
    viaUpstream: row.via_upstream,
    direction: row.direction ?? "inbound",
  };
}
