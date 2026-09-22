-- Plan 15: append-only config history. Written in the same transaction as the
-- change it records — a change with no event is a change nobody can undo.
create table config_event (
  id        bigserial   primary key,
  slug      text        not null,
  at        timestamptz not null default now(),
  actor     text,                       -- user id, token name, or 'repo-sync'
  kind      text        not null,       -- project.update | rule.create | rule.update
                                        -- | rule.delete | rule.reorder | import | revert
  target_id text,                       -- rule id, where applicable
  before    jsonb,                      -- null on create
  after     jsonb,                      -- null on delete
  version   bigint      not null        -- config_version after this event
);
create index config_event_slug_at_idx on config_event (slug, at desc);
