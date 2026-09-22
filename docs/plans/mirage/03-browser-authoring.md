---
title: 03 — Browser authoring
size: M (3–5 days)
depends on: 02
status: DRAFT
---

# 03 — Browser authoring

Turn every "Preview" create/edit surface into a real one. This is verb 1: make a
mock without leaving the browser.

## Problem

Today every write path ends in "copy this YAML, open a PR, wait ~40 s".
`CreateProjectModal`, `CreateEndpointModal`, `CreateCaseModal` and `RuleBuilder`
all emit copy-paste text. `app/_lib/scaffold-yaml.ts` and `app/_lib/rule-yaml.ts`
exist solely to render that text. Two of them (B1) emit configuration that is
actively broken.

## Design

### The 15-second path is the default

The create form's first and default tab is **Paste a response**:

```
Method  [POST v]   Path  [/orders/:id                  ]
Response status [201]
Body   [ { "id": "{{request.path.id}}", "status": "created" }    ]
                                                    [ Create ]
```

Save, and the panel is replaced by the live URL, a copy button and a ready-to-run
`curl`. Everything else — match conditions, headers, delay — is progressive
disclosure behind "Add conditions".

Other tabs: **Import** (plan 08), **From OpenAPI** (exists server-side today),
**Record from upstream** (plan 07). They arrive later; the tab strip is built here
so adding one is not a redesign.

### Editing

An inline editor in the endpoint workspace's centre column, not a modal — a modal
cannot sit beside the traffic rail (plan 05, §6.3 of the design doc), and the whole
point is editing while watching requests land.

- Match conditions use the existing `RuleBuilder` component, re-pointed from
  `sessionStorage` at the store.
- A raw JSON/YAML escape hatch per rule, for anything the builder cannot express.
- **Reordering:** drag to set `position`. First-match-wins is invisible today and
  is the single most common source of "why did I get the wrong response".
- **Duplicate** and **Delete** on each rule — currently disabled menu items in
  `CaseRow.tsx:48-51`.

### Validation

One validator, shared. `src/compile/schema.ts` moves to `src/schema/` and is
imported by the compiler, the save endpoint and the client form. The client gets
instant feedback; **the server re-validates and is the authority** — never trust
the form.

Save is refused, with the error on the offending field, when the schema rejects,
when a template token is unknown, when the rule id collides, or when a header value
carries a control character (B12).

**A save also runs the shadow check (B10)** and surfaces "this rule is unreachable,
rule X above already matches everything it matches" as a **warning with a Move-up
action** — not a block. This is the compile-time diagnostic finally arriving where
someone can act on it.

### API

```
POST   /api/projects                  create
PATCH  /api/projects/:slug            name, basePath, defaults
DELETE /api/projects/:slug            requires typing the slug to confirm
POST   /api/projects/:slug/rules      create
PATCH  /api/projects/:slug/rules/:id  edit
DELETE /api/projects/:slug/rules/:id
POST   /api/projects/:slug/rules/reorder   { ruleIds: string[] }
```

Route handlers under `app/api/`, deliberately outside `app/m/` so the mock hot
path never shares code with the write path. Until [14 — auth](14-auth-workspaces.md)
lands, these are gated by a single `MIRAGE_ADMIN_TOKEN` bearer check. Unauthenticated
write endpoints must not ship even for one deploy.

### Export back to files

Every project gets **Export to YAML** — a `mocks/<slug>/` tree as a download, byte-
compatible with the compiler. Repo-managed projects show "edit in repo" instead of
the editor. A GitHub App that opens the PR directly is a later, optional addition;
the download keeps the promise without the integration.

## UI changes

| file | change |
|---|---|
| `app/_features/projects/CreateProjectModal.tsx` | YAML output replaced by a real create; drop `basePath: /` (B1) |
| `app/_features/endpoints/CreateEndpointModal.tsx` | becomes the paste-a-response form |
| `app/_features/cases/CreateCaseModal.tsx` | real create against the store |
| `app/_features/cases/CaseRow.tsx` | enable Duplicate / Edit / Delete |
| `app/_features/rules/RuleBuilder.tsx` | `usePreview` replaced by the store mutation |
| `app/_features/settings/GeneralTab.tsx` | editable, with a save |
| `app/_features/settings/DangerZoneTab.tsx` | real delete, type-to-confirm |
| `app/_lib/scaffold-yaml.ts`, `rule-yaml.ts` | keep — now the export path, not the only path |
| `app/_shell/PreviewBadge.tsx` | removed from every surface this plan makes real |

## Tests

- Create → the rule is servable at its URL within one cache TTL.
- Invalid template token → 400 with the token named, nothing written.
- Reorder → resolution order changes accordingly.
- Shadowed rule → warning returned on save with the shadowing rule id.
- Repo-managed project → every write endpoint returns 409.
- No bearer token → 401 on every write endpoint.
- The YAML export of a store project recompiles to an identical config.

## Risks

| risk | mitigation |
|---|---|
| A bad save breaks a live mock instantly — no build to catch it | Server-side validation is the same code the build uses; plan 15 adds one-click revert. |
| Two editors overwrite each other | `config_version` compare-and-set on save; a conflict returns 409 with a diff. |
| Write endpoints exposed | Bearer token from day one, replaced by real auth in plan 14. |

## Rollback

Revert the UI commits; the API routes can stay dormant. Repo projects are
unaffected throughout.

## Done when

A new project with a working endpoint can be created from the browser in under
60 seconds, its URL returns the expected response, and no `PreviewBadge` remains on
a create/edit surface.
