-- Same two tables as 001-init.postgres.sql, translated to SQLite:
-- jsonb -> text (JSON.stringify'd, parsed back by the driver), bigserial ->
-- integer primary key autoincrement, timestamptz -> text ISO-8601.
create table project (
  slug            text primary key,
  workspace_id    text not null default 'default',
  name            text not null,
  base_path       text,
  defaults        text not null,
  openapi_doc     text,
  source          text not null default 'store',
  config_version  integer not null default 1,
  created_at      text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at      text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create table rule (
  id           integer primary key autoincrement,
  slug         text not null references project(slug) on delete cascade,
  rule_id      text not null,
  position     integer not null,
  definition   text not null,
  created_at   text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  unique (slug, rule_id)
);
create index rule_slug_position_idx on rule (slug, position);
