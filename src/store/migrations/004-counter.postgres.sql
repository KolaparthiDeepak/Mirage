-- Plan 10: per-(slug, rule, session) call counters for stateful variant rules.
-- Additive; a non-variant rule never touches this table.
create table counter (
  slug       text        not null,
  rule_id    text        not null,
  session    text        not null,
  n          bigint      not null default 0,
  updated_at timestamptz not null default now(),
  primary key (slug, rule_id, session)
);
create index counter_updated_at_idx on counter (updated_at);
