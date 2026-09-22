---
title: 21 — Saved views and alerts
size: S (1–2 days)
depends on: 05
status: DRAFT
---

# 21 — Saved views and alerts

Make traffic answer questions without anyone watching the screen.

## Problem

Plan 05 gives filters that live in the URL. That is sufficient for looking and
insufficient for noticing: nobody watches a mock server, so an integration that
starts sending the wrong shape is discovered whenever someone happens to look.

## 21.1 Saved views

A named filter set, pinned to the project's traffic page.

- Ships with three built-ins, because most people never create one: **Unmatched**,
  **Errors (5xx)**, **Slow (p95 and above)**.
- User-created views are stored per project and shared with the workspace.
- Each view shows a live count badge in the sidebar — the count is the feature.
  "Unmatched: 12" seen in passing is worth more than a dashboard nobody opens.

Cheap: filters are already URL-encoded, so a saved view is a name plus a query
string plus a cached count.

## 21.2 Alerts

An alert is a saved view plus a threshold plus a destination.

```yaml
- name: Unmatched spike
  view: unmatched
  condition: { count: { gt: 10 }, window: 5m }
  notify: { webhook: https://hooks.slack.com/... }
  cooldown: 30m
```

**Three conditions only**, and the restraint is deliberate — an alerting DSL is a
product of its own and this is a mock server:

| condition | catches |
|---|---|
| unmatched count over threshold in a window | a client calling a path that does not exist — the most common real failure |
| 5xx rate over threshold | a broken rule or an upstream failure (plan 07) |
| no traffic in a window | a CI job that stopped calling, or a broken base URL |

The third is the one people forget to build and then wish they had: silence is a
symptom, and nothing else detects it.

### Delivery

Webhook (generic JSON), plus Slack and Discord as pre-shaped payloads for the two
formats everyone actually uses. Email is deferred — it needs a provider, a
reputation and a bounce story, which is disproportionate here.

The webhook sender **reuses the SSRF guard from plan 07**. Same module, same tests,
third caller.

### Evaluation

A 1-minute cron over one grouped query per active alert. Alerts are per project and
capped at 10, so the query load is bounded by construction.

`cooldown` prevents a flapping alert from becoming noise; a resolved alert sends one
recovery notification and nothing more.

## UI

Traffic gains a saved-view rail with counts. Settings gains an **Alerts** tab: list,
edit, a **Test** button that fires the notification immediately, and per-alert
last-fired and last-error.

## Tests

- A saved view round-trips to the same filtered result set.
- View counts match the underlying query.
- Each of the three alert conditions fires on its fixture and not otherwise.
- Cooldown suppresses a repeat inside the window.
- Recovery sends exactly one notification.
- A webhook URL resolving into a private range is rejected at save.
- A failing webhook records the error and does not retry indefinitely.

## Risks

| risk | mitigation |
|---|---|
| Alert fatigue | Three condition types, cooldown, ten-alert cap, recovery notifications. |
| Cron evaluation cost | One grouped query per alert per minute; capped and measured. |
| SSRF via webhook URL | Shared guard module from plan 07. |

## Rollback

Disable evaluation; saved views keep working independently.

## Done when

An unmatched spike posts to Slack within a minute, silence is detectable, and the
three built-in views are one click from the traffic page.
