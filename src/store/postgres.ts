import postgres, { type Sql } from "postgres";
import { loadMigrations } from "./migrate";
import type { ProjectSummary, Store, StoredProject, StoredRule } from "./types";

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
        insert into project (slug, name, base_path, defaults, openapi_doc, source, config_version, updated_at)
        values (
          ${p.slug}, ${p.name}, ${p.basePath ?? null}, ${tx.json(toJsonb(p.defaults))},
          ${p.openApiDoc != null ? tx.json(toJsonb(p.openApiDoc)) : null}, ${p.source}, ${nextVersion}, now()
        )
        on conflict (slug) do update set
          name = excluded.name, base_path = excluded.base_path, defaults = excluded.defaults,
          openapi_doc = excluded.openapi_doc, source = excluded.source,
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

  async close(): Promise<void> {
    await this.sql.end();
  }
}
