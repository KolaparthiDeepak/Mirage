-- Same as 004-counter.postgres.sql. bigint -> integer, timestamptz -> text ISO-8601.
create table counter (
  slug       text    not null,
  rule_id    text    not null,
  session    text    not null,
  n          integer not null default 0,
  updated_at text    not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  primary key (slug, rule_id, session)
);
create index counter_updated_at_idx on counter (updated_at);
