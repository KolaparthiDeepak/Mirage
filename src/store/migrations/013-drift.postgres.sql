-- Plan 22: drift detection config (on project) and current drift state (one
-- row per rule, upserted by each check; a rule with no drift has no row).
alter table project add column drift jsonb;

create table drift_report (
  id               text        not null, -- == rule_id, or "__openapi_spec__"
  slug             text        not null,
  rule_id          text        not null,
  findings         jsonb       not null default '[]',
  observed_response jsonb,
  error            text,
  dismissed        boolean     not null default false,
  first_seen_at    timestamptz not null default now(),
  last_checked_at  timestamptz not null default now(),
  primary key (slug, id)
);
