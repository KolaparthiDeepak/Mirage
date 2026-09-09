-- Plan 02: project config storage. Traffic (plan 04) and counter (plan 10)
-- tables arrive in their own numbered migrations when those plans are built.
create table project (
  slug            text primary key,
  workspace_id    text        not null default 'default',
  name            text        not null,
  base_path       text,
  defaults        jsonb       not null,
  openapi_doc     jsonb,
  source          text        not null default 'store',
  config_version  bigint      not null default 1,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table rule (
  id           bigserial primary key,
  slug         text   not null references project(slug) on delete cascade,
  rule_id      text   not null,
  position     int    not null,
  definition   jsonb  not null,
  created_at   timestamptz not null default now(),
  unique (slug, rule_id)
);
create index rule_slug_position_idx on rule (slug, position);
