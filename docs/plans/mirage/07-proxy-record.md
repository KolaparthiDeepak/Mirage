---
title: 07 — Proxy and record from upstream
size: M (3–5 days)
depends on: 02, 04
status: DRAFT
---

# 07 — Proxy and record from upstream

The fastest way to author a realistic mock is not to write one. It is to let the
real service answer once and keep the answer.

## Problem

Writing a faithful mock of an existing API means transcribing bodies by hand from
somewhere else. Every serious mock tool (WireMock, Mockoon, Beeceptor) solves this
with record-and-replay, and it is the feature users reach for first.

## Design

### Modes, per project

| mode | unmatched request behaviour |
|---|---|
| `off` (default) | `defaults.notFound` — today's behaviour, unchanged |
| `record` | forwarded to `upstreamUrl`, real response returned **and** recorded |
| `passthrough` | forwarded, returned, not recorded |

Matched requests are **always** served by the mock. The proxy is strictly a
fallback for what the mock does not know, so turning it on can never change an
existing rule's behaviour. That property is what makes the feature safe to leave on.

### Flow

```
request → resolve() → matched?  yes → serve the mock            (unchanged)
                              no  → mode off        → notFound  (unchanged)
                                  → mode record     → fetch upstream
                                                    → return the real response
                                                    → record it, flagged `viaUpstream`
```

### Promoting a recording to a mock

A recorded exchange appears in traffic with a **Save as mock** action. It opens
plan 03's editor pre-filled with the method, the path (path segments that look
like ids offered as `:param`), the status, the response body and headers. The
author edits and saves. Nothing is auto-promoted — a silent write to live config
from external traffic would be the wrong default.

**Bulk promote** on the recording list: select many, create rules for all, with a
collision report for paths that already have one.

### Safety — the part that must not be rushed

Server-side `fetch` to a user-supplied URL is **SSRF**. Non-negotiable controls:

1. `upstreamUrl` must be `https://`, with a hostname, at save time.
2. **Resolve the hostname and reject private ranges** — `127.0.0.0/8`,
   `10/8`, `172.16/12`, `192.168/16`, `169.254/16` (cloud metadata),
   `::1`, `fc00::/7` — checked **after** DNS resolution, and re-checked on
   redirect, or DNS rebinding walks straight through.
3. **`redirect: "manual"`.** A redirect is returned to the caller as-is, never
   followed. This removes the rebinding window entirely and is simpler than
   re-validating each hop.
4. **Timeout 5 s**, response cap **5 MB**, both hard.
5. **Rate limit** per project, default 60 upstream calls/minute.
6. Hop-by-hop headers stripped both directions. The `host` header is rewritten.
   `Authorization` is forwarded only when the project explicitly opts in.
7. Recorded upstream responses go through plan 04's redaction before storage.

This list is the plan. If any item is cut, the feature is not shippable.

### Configuration

```yaml
upstream:
  url: https://api.example.com
  mode: record          # off | record | passthrough
  forwardAuth: false
  timeoutMs: 5000
```

Stored on `project`, editable in Settings, exported to YAML like any other config.

## UI

- Settings gains an **Upstream** tab: URL, mode, a **Test connection** button that
  performs one validated request and reports the result.
- Traffic rows served by the upstream carry a distinct badge — never confusable
  with a mocked response.
- A **Recordings** view: unmatched-and-recorded exchanges, with select-and-promote.

## Tests

- Matched request with `mode: record` → served by the mock, upstream never called.
- Unmatched with `mode: record` → upstream called once, real response returned,
  recorded with the flag.
- `upstreamUrl` pointing at `localhost`, `169.254.169.254`, or a hostname that
  resolves into a private range → rejected at save.
- A redirect toward a private address → returned, not followed.
- Upstream timeout → 504 from Mirage with a clear body, and a recorded error row.
- A 50 MB upstream response → truncated at the cap, flagged.
- Promote produces a rule that serves the recorded body byte-identically.

## Risks

| risk | mitigation |
|---|---|
| SSRF into internal infrastructure | The seven controls above, tested individually. This is the main risk in the entire roadmap. |
| Upstream latency becomes Mirage's latency | 5 s timeout inside `maxDuration: 10`; the mode is per project and opt-in. |
| Recording captures production secrets | Plan 04 redaction applies; `forwardAuth` defaults false. |
| Cost of proxying a chatty client | Per-project rate limit, with a clear error when exceeded. |

## Rollback

`MIRAGE_UPSTREAM=off` forces every project to `mode: off`. Recorded rows remain.

## Done when

An unmatched request against a configured upstream returns the real response, is
recorded, and can be promoted to a working rule in two clicks — and every SSRF test
above is green.
