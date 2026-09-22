-- Same as 013-drift.postgres.sql. jsonb -> text, boolean -> integer,
-- timestamptz -> text ISO-8601.
alter table project add column drift text;

create table drift_report (
  id               text    not null,
  slug             text    not null,
  rule_id          text    not null,
  findings         text    not null default '[]',
  observed_response text,
  error            text,
  dismissed        integer not null default 0,
  first_seen_at    text    not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  last_checked_at  text    not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  primary key (slug, id)
);
