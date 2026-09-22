-- Plan 21: saved views (a name + a traffic filter) and alerts (a view + a
-- threshold + a destination). Alerts carry their own evaluation state
-- (last fired/recovered/error, currently firing) so the cron sweep and the
-- Test button both read and write through one row, never two sources of truth.
create table saved_view (
  id         text        not null,
  slug       text        not null,
  name       text        not null,
  query      jsonb       not null,
  created_at timestamptz not null default now(),
  primary key (slug, id)
);

create table alert (
  id                 text        not null,
  slug               text        not null,
  name               text        not null,
  view               text        not null,
  condition          jsonb       not null,
  notify             jsonb       not null,
  cooldown_minutes   int         not null default 30,
  enabled            boolean     not null default true,
  last_fired_at      timestamptz,
  last_recovered_at  timestamptz,
  last_error         text,
  currently_firing   boolean     not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  primary key (slug, id)
);
create index alert_enabled_idx on alert (enabled) where enabled;
