-- Same as 010-flows.postgres.sql. jsonb -> text, timestamptz -> text ISO-8601,
-- uuid -> text.
create table flow (
  id          text not null,
  slug        text not null,
  name        text not null,
  definition  text not null,
  created_at  text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at  text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  primary key (slug, id)
);

create table flow_run (
  id          text    primary key,
  slug        text    not null,
  flow_id     text    not null,
  started_at  text    not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  finished_at text,
  status      text    not null,
  results     text    not null default '[]'
);
create index flow_run_slug_flow_started_idx on flow_run (slug, flow_id, started_at desc);
