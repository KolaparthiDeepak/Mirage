---
title: 15 — Config history and revert
size: S (1–2 days)
depends on: 02
status: DRAFT
---

# 15 — Config history and revert

Cheap insurance, and the first thing anyone asks for after a shared mock changes
under them.

## Problem

Under the file workflow, `git log` is the history and `git revert` is the undo.
Plan 03 removes both for store-managed projects: a save is instant, unattributed
and irreversible. That is a strictly worse property than the system it replaces,
and it should not be allowed to stand for even one release.

## Design

### Append-only, on every write

```sql
create table config_event (
  id         bigserial primary key,
  slug       text        not null,
  at         timestamptz not null default now(),
  actor      text,                      -- user id, token name, or 'repo-sync'
  kind       text        not null,      -- project.update | rule.create
                                        -- rule.update | rule.delete | rule.reorder | import
  target_id  text,                      -- rule id, where applicable
  before     jsonb,                     -- null on create
  after      jsonb,                     -- null on delete
  version    bigint      not null       -- config_version after this event
);
create index on config_event (slug, at desc);
```

Written in the same transaction as the change. Not fire-and-forget — unlike
traffic, this **is** part of the contract: a change that happened without a
history row is a change nobody can undo.

### Views

- **History** page per project: a reverse-chronological feed — *"editor@x changed
  `get-card-lost` 4 minutes ago"* — with a rendered diff per event.
- **Per-rule history** in the rule editor: this rule's changes only.
- **Version marker in traffic**: plan 04 records `configVersion` per request, so a
  traffic row links to the exact config that served it, and "it worked an hour ago"
  becomes a link rather than an argument.

### Revert

- **Revert this change** — applies the inverse of one event.
- **Restore to version N** — replays the project to a prior state.

Both are **new events**, never deletions. History is append-only, so a revert of a
revert is coherent and nothing is ever lost.

Reverting a rule that no longer exists recreates it, at its recorded `position`,
with a note in the diff. Conflicts — the target changed since — are shown side by
side and require confirmation.

Reuses the diff primitive built in plan 05.

### Retention

Config events are small and precious: **keep 1000 per project or 1 year**,
whichever is larger. Not on the aggressive traffic retention schedule.

### Repo-managed projects

Repo-sourced projects show git history instead, with a link to the commit — the
`sync-cli` writes a `repo-sync` event carrying the commit sha, so the two
histories are one timeline.

## UI

`Settings → History` tab, plus an inline "last changed by X, N ago" line on each
rule in the editor. Attribution at the point of confusion is worth more than a
page nobody visits.

## Tests

- Every write path produces exactly one event with correct before/after.
- Revert restores the prior state exactly and creates a new event.
- Restore-to-version replays a multi-event sequence correctly.
- Reverting a deleted rule recreates it at its original position.
- A conflicting revert requires confirmation and does not apply silently.
- `configVersion` on a traffic row resolves to the correct historical config.
- A repo sync writes an event carrying the commit sha.

## Risks

| risk | mitigation |
|---|---|
| History write failure loses a change record | Same transaction as the write; the write fails if the event cannot be recorded. |
| Large `before`/`after` blobs | Rules are small; a size cap with a truncation marker for pathological bodies. |
| Revert applied to a since-changed rule | Conflict detection with a side-by-side diff and explicit confirmation. |

## Rollback

Hide the UI; keep writing events. Never stop recording — a gap in history is
permanent.

## Done when

Every config change is attributed and diffable, any change can be reverted in one
click, and a traffic row links to the config version that served it.
