-- Plan 04: traffic recording. Redaction happens before a row ever reaches
-- this table (src/store/redact.ts) — nothing here re-redacts on read.
create table traffic (
  id uuid primary key,
  slug text not null,
  at timestamptz not null default now(),
  method text not null,
  path text not null,
  query jsonb not null default '{}',
  req_headers jsonb not null default '{}',
  req_body text,
  status int not null,
  res_headers jsonb not null default '{}',
  res_body text,
  matched_rule_id text,
  duration_ms int not null,
  warnings jsonb not null default '[]',
  client_hash text,
  config_version bigint,
  truncated boolean not null default false
);
create index traffic_slug_at_idx on traffic (slug, at desc);
create index traffic_slug_rule_at_idx on traffic (slug, matched_rule_id, at desc);
-- Unmatched-inbox (plan 05): instant regardless of total volume.
create index traffic_slug_unmatched_idx on traffic (slug, at desc) where matched_rule_id is null;
