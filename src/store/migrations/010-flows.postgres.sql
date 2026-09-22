-- Plan 16: flows — a saved, runnable sequence of requests with assertions.
create table flow (
  id          text        not null,
  slug        text        not null,
  name        text        not null,
  definition  jsonb       not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (slug, id)
);

create table flow_run (
  id          uuid        primary key,
  slug        text        not null,
  flow_id     text        not null,
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  status      text        not null,       -- running | passed | failed | error
  results     jsonb       not null default '[]'
);
create index flow_run_slug_flow_started_idx on flow_run (slug, flow_id, started_at desc);
