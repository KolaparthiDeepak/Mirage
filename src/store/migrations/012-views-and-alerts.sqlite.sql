-- Same as 012-views-and-alerts.postgres.sql. jsonb -> text, boolean -> integer,
-- timestamptz -> text ISO-8601.
create table saved_view (
  id         text not null,
  slug       text not null,
  name       text not null,
  query      text not null,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  primary key (slug, id)
);

create table alert (
  id                text    not null,
  slug              text    not null,
  name              text    not null,
  view              text    not null,
  condition         text    not null,
  notify            text    not null,
  cooldown_minutes  integer not null default 30,
  enabled           integer not null default 1,
  last_fired_at     text,
  last_recovered_at text,
  last_error        text,
  currently_firing  integer not null default 0,
  created_at        text    not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at        text    not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  primary key (slug, id)
);
create index alert_enabled_idx on alert (enabled);
