-- Same table as 002-traffic.postgres.sql. jsonb -> text (JSON.stringify'd),
-- timestamptz -> text ISO-8601, uuid -> text. SQLite supports partial indexes
-- (3.8.0+), so the unmatched-inbox index below is not a Postgres-only trick.
create table traffic (
  id text primary key,
  slug text not null,
  at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  method text not null,
  path text not null,
  query text not null default '{}',
  req_headers text not null default '{}',
  req_body text,
  status integer not null,
  res_headers text not null default '{}',
  res_body text,
  matched_rule_id text,
  duration_ms integer not null,
  warnings text not null default '[]',
  client_hash text,
  config_version integer,
  truncated integer not null default 0
);
create index traffic_slug_at_idx on traffic (slug, at desc);
create index traffic_slug_rule_at_idx on traffic (slug, matched_rule_id, at desc);
create index traffic_slug_unmatched_idx on traffic (slug, at desc) where matched_rule_id is null;
