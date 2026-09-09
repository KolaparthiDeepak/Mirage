---
title: 23 — Onboarding and first run
size: S (1–2 days)
depends on: 03
status: DRAFT
---

# 23 — Onboarding and first run

Time from landing to a working mock URL is the metric that decides whether anyone
comes back. Today it is measured in minutes and a documentation read.

## Problem

The first-run experience is: a 3.2-second full-screen canvas animation (B15), then
a read-only project list, then — for anyone who wants to create something — a
modal that emits YAML with instructions to open a pull request.

`IntroSplash.tsx` runs on **every** page load, deliberately (commit `36ae75a`),
rasterising a full-viewport offscreen canvas, calling `getImageData` across it, and
animating 2400 particles for 3.2 s plus a 450 ms fade, with no click-to-skip. It is
genuinely lovely canvas work in exactly the wrong place: the product's job is
answering "is my mock live?" and the answer arrives 3.65 seconds late, every time.

## Design

### The splash

Keep it, shrink it, make it escapable:

- **First visit only**, remembered in `localStorage`.
- **800 ms** cap, and an immediate exit on any click, key or scroll.
- `prefers-reduced-motion` still skips it entirely (already correct).
- Available on demand from an "about" affordance, for anyone who wants to see it
  again.

Deleting it outright would be the lazy call; it is a genuine piece of craft and it
costs nothing when it runs once, briefly, and yields to input.

### The 60-second path

An empty workspace shows **one** thing: plan 03's paste-a-response form, inline —
not a modal, not a card that opens a modal.

```
Your first mock                                              1 of 1

  Method [POST v]  Path [/hello                           ]
  Returns  [ { "message": "hello" }                       ]

                                            [ Create mock ]
```

On save, the screen becomes:

```
  Live now
  https://mirage.…/m/my-api/hello                        [copy]

  curl -sS https://mirage.…/m/my-api/hello                [copy]

  ○ waiting for your first request…
```

That last line matters: it **watches traffic** (plan 04) and flips to the request's
detail view the moment one arrives. The loop closes itself — create, call, see it —
without the user knowing that traffic, matching or rules exist yet.

### Sample project

A **"Try a sample"** button creating a small, real project (three endpoints, a
match condition, a templated response, an intentional unmatched example). Not a
tour, not a modal sequence — a project someone can immediately break and fix.

This is how the existing feature set gets discovered. Guided tours get dismissed;
a project you can poke at does not.

### Progressive disclosure elsewhere

Empty states, not tutorials:

| page | empty state |
|---|---|
| Traffic | "No requests yet" + the project's `curl`, copy-ready |
| Rules | "One rule, no conditions — add one to branch on the request" |
| Flows | "Turn requests you've already made into a flow" + a link to traffic |
| Contract | "Import an OpenAPI spec to see coverage" |

Each empty state teaches the one thing that page is for and offers the action.

### Docs in the product

The keyboard shortcut sheet, the template token list (from `template.ts`'s
allowlist) and the match-operator table (from `mock-format.md`) surfaced in the
command palette — the tokens especially, since they are an allowlist and guessing
wrong is a build error.

## Tests

- The splash renders once, then never again; a click exits it early; reduced motion
  skips it.
- An empty workspace shows the inline create form as the primary element.
- The post-create screen shows the correct absolute URL and a working `curl`.
- The waiting indicator flips to the request detail when the first request lands.
- "Try a sample" produces a working project with all four described features.
- Every listed page has its empty state.

## Risks

| risk | mitigation |
|---|---|
| Removing the splash from every load loses the intended personality | Kept, shortened, first-visit-only, replayable on demand. |
| The sample project clutters a real workspace | Clearly labelled, one-click delete. |
| Onboarding hardcodes assumptions that later drift | Built from the same components as the real create flow — one implementation. |

## Rollback

Restore the previous first-run behaviour. No data involved.

## Done when

A first-time visitor has a working, called, visible mock in under 60 seconds
without reading documentation, and the splash never delays a returning user.
