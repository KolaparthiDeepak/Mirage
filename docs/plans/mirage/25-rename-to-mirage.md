---
title: 25 — Rename to Mirage
size: S (1 day)
depends on: nothing
status: APPROVED (design doc §8, decision 4)
---

# 25 — Rename to Mirage

The product has two names and answers to both badly.

## Problem

`app/layout.tsx:20` sets `metadata.title` to **Mirage**. `IntroSplash.tsx:67`
renders the wordmark **"◆ Mirage"**. `GlobalSearch.tsx:184` labels its input
"Search Mirage". Meanwhile the repository, `package.json`, the README, every
document in `docs/`, and the `/__mock/health` payload all say **mockservers**.

Someone arriving at the deployed app sees Mirage; someone arriving at the repo
sees mockservers; nothing explains the relationship. **Decision: the name is
Mirage.** Do this in phase 0, before any external surface hardens around the old
name.

## Changes

### Rename — code and metadata

| target | from | to |
|---|---|---|
| `package.json` `name` | `mockservers` | `mirage` |
| GitHub repository | `KolaparthiDeepak/mockservers` | `KolaparthiDeepak/mirage` |
| README title and prose | mockservers | Mirage |
| `docs/**` prose | mockservers | Mirage |
| `/__mock/health` payload | — | add `"service": "mirage"` |
| local storage keys | `mockservers-theme`, `mockservers-preview` | see below |

### Do **not** rename

- **`/m/<slug>/…`** — the mock URL path. Someone's CI calls it. It has no product
  name in it, which is lucky, and it stays exactly as it is.
- **`/__mock/health`, `/__mock/projects`, `/m/<slug>/__spec`** — same reasoning.
  `__mock` is a namespace, not a brand, and renaming it to `__mirage` would break
  every existing caller for zero gain.
- **`app/%5F%5Fmock/`** — the URL-encoded directory name is a Next.js routing
  workaround (README, "Do not rename"), not a naming choice. Renaming it silently
  404s the health endpoint with no build error.
- **`mocks/`** — the directory holds mocks. That is a description, not a brand.

The rule: rename what describes *the product*, never what forms *an address*.

### localStorage keys

`app/_lib/theme.ts:3` uses `mockservers-theme`; `preview-store.tsx:24` uses
`mockservers-preview`. Renaming the key drops every existing user's theme choice
back to the default.

Read the old key, write the new one, keep the fallback for one release:

```ts
const KEY = "mirage-theme";
const LEGACY_KEY = "mockservers-theme";
// read: localStorage.getItem(KEY) ?? localStorage.getItem(LEGACY_KEY)
```

The inline anti-flash script in `app/layout.tsx:25` reads the key before React
mounts and must check both, or the first paint after the rename is the wrong theme.

`mockservers-preview` needs no migration — plan 17 deletes that store entirely, and
its contents are per-tab and disposable.

### Domain

`mockservers.dailyuze.com` is live in Vercel and DNS. Add `mirage.dailyuze.com`
alongside it and **301 the old host to the new one**, keeping the path. Do not
retire the old hostname — the README advertises it and a mock URL that stops
resolving is exactly the failure this product exists to prevent.

### GitHub rename

GitHub redirects the old repository path indefinitely for clones and web traffic,
so the rename is safe. Update the remote locally, and update every URL in the
design docs and README that names the old repo.

## Tests

- No occurrence of `mockservers` outside `mocks/`, the `%5F%5Fmock` directory
  name, and the deliberate legacy-key fallbacks — enforced by a grep test so the
  name cannot drift back.
- `/__mock/health` returns `service: "mirage"` and is still reachable.
- `/m/card-block-lost/...` is byte-identical before and after.
- A browser with `mockservers-theme: paper` set still renders Paper after the
  rename, with no flash of the wrong theme on first paint.
- `mockservers.dailyuze.com/m/<slug>/x` 301s to `mirage.dailyuze.com/m/<slug>/x`
  with the path preserved.

## Risks

| risk | mitigation |
|---|---|
| A mock URL breaks | Mock paths are untouched; the old hostname keeps working via redirect. |
| Theme preference lost | Legacy key fallback in both the module and the inline anti-flash script. |
| A stale `mockservers` reference reappears later | Grep test in CI. |
| Repo links rot | GitHub redirects old paths indefinitely; docs updated in the same commit. |

## Rollback

Revert the commit; re-point `package.json`. The GitHub rename can be reversed, and
DNS keeps both hostnames working throughout.

## Done when

One name everywhere in the product, every existing mock URL unchanged, the old
hostname redirecting, and the grep test green.
