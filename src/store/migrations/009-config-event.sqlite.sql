-- Same as 009-config-event.postgres.sql. bigserial -> integer autoincrement,
-- timestamptz -> text ISO-8601, jsonb -> text.
create table config_event (
  id         integer primary key autoincrement,
  slug       text    not null,
  at         text    not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  actor      text,
  kind       text    not null,
  target_id  text,
  before     text,
  after      text,
  version    integer not null
);
create index config_event_slug_at_idx on config_event (slug, at desc);
