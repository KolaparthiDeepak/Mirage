# mockservers — Obsidian Midnight redesign

Date: 2026-08-30
Status: design approved (brainstorm + visual mocks), pending implementation plan
Supersedes: `app/page.tsx` + `app/_explorer/*` (the single-page 3D/2D explorer from
`docs/specs/2026-08-29-mockservers-viewer-3d-design.md`)
Source spec: `docs/specs/2026-08-29-mockservers-luxury-ui-source-spec.md`
Visual mocks: reviewed and approved — 16 screens, Obsidian theme, real card-block-lost data

## 1. Goal

Turn the explorer into a premium developer tool: a routed application shell
(sidebar + top bar + main), the Obsidian Midnight theme, and the full page set
from the source spec — Projects, Overview, Endpoints, Endpoint Workspace, Cases,
Rules, Scenarios, Traffic, Environments, Variables, Public Mock Server, Settings,
plus a command palette and global search.

Personality: Linear × Vercel × Raycast × Postman. Minimal, technical, calm,
keyboard-friendly, information-dense without crowding.

## 2. Non-goals

- **No backend changes.** `src/engine/*`, `src/compile/*`, `src/openapi/*`,
  `src/viewer/{model,curl,verdict}.ts`, `app/m/[...slug]/route.ts`,
  `app/%5F%5Fmock/*`, `mocks/**`, `mocks.generated.json`, `scripts/*` are
  untouched. Same compile pipeline, same request resolution, same cURL output.
- **No writes to `mocks/**` from the browser.** Still the deferred "browser
  editing" README item. Create/edit UIs emit copy-paste YAML.
- **No new server routes**, no proxy, no request logging beyond the stdout line
  `route.ts` already prints.
- **No auth.** Viewer and mocks are public.
- **No real traffic store, env store, variable store, scenario runner.** Those
  pages are PREVIEW (§3).
- **No WebGL.** The 3D monolith and `SignalTrace` SVG animation are dropped —
  the source spec explicitly rejects decorative effects and unnecessary motion.
- **No new heavy dependencies.** No component library, no state library, no
  styling library. Next 15 + React 19 + CSS, as today.

## 3. REAL vs PREVIEW

Every clickable control either works against the existing backend (REAL) or is
visually complete with isolated local-only state and a visible "Preview"
affordance (PREVIEW). No control silently no-ops; no PREVIEW feature writes
anything a user could mistake for persistence.

| Area | Status | Backing |
|---|---|---|
| Projects list, project switch | REAL | `buildViewModel(bundle).projects` |
| Endpoints list, grouped view | REAL | `ProjectVM.endpoints` |
| Cases list (read), case detail | REAL | `EndpointVM.cases` |
| Request runner: method/url/headers/body edit, Execute, response, timing, verdict | REAL | existing `Runner` `fetch` + `classifyResult` |
| cURL generation + copy | REAL | `renderCurl(draft.curl)` |
| Rules — **read** of `match` conditions | REAL | `CaseVM.match` (`MatchCondition[]`) |
| Public mock URL, copy, `/__spec` link, QR of base URL | REAL | `runUrl`, `project.openApiDoc != null` |
| Settings — **read** of name/slug/basePath/defaults | REAL | `ProjectVM` + bundle project config |
| Theme toggle (Obsidian default + light "Paper") | REAL | existing `data-theme` + localStorage |
| Command palette — navigation + REAL-action commands | REAL | client router + existing handlers |
| Global search — projects / endpoints / cases | REAL | in-memory filter of `ViewModel` |
| Create project / endpoint / case | PREVIEW | modal emits `mocks/<slug>/*.yaml` snippet to copy |
| Rules — **create/edit** | PREVIEW | local state; "export YAML" action; never hot-reloads |
| Traffic list + detail drawer + replay | PREVIEW | sample data; "Replay" hands off to the REAL runner |
| Environments (select, add) | PREVIEW | local state; active env swaps runner base URL client-side |
| Variables (add, reveal, scope) | PREVIEW | local state; substituted into drafts client-side only |
| Scenario Builder (add/edit/remove step, canvas) | PREVIEW | local state; "Run scenario" disabled with tooltip |
| Code-gen: Java / Python / JavaScript / Go | PREVIEW | tab present, body shows "coming soon" note |
| Import: OpenAPI | REAL-ish | backend already merges specs at compile; UI explains the file-drop → repo flow |
| Import: Postman | PREVIEW | disabled card |
| Overview "Requests" / "Success" counters | PREVIEW | shown as `—` with a preview label, never a fake number |

PREVIEW state lives in React context + `sessionStorage` (per-tab, never sent
anywhere), fully separated from the `ViewModel`. See §7.

## 4. Routing

Move from in-state view switching to real Next.js App Router routes. All pages
are client components under a shared server layout that builds the `ViewModel`
once and passes it down via a context provider.

```
app/
  layout.tsx                      root — fonts, theme script (unchanged shape)
  page.tsx                        redirect → /projects
  (app)/
    layout.tsx                    server: buildViewModel(bundle) → <AppProviders model>; renders <AppShell>
    projects/page.tsx             PAGE 01
    p/[slug]/
      layout.tsx                  resolves project from context; sets project nav context; 404 if unknown
      page.tsx                    PAGE 02 overview
      endpoints/page.tsx          PAGE 03 list  +  PAGE 04 workspace (?e=<key> opens the 3-col workspace)
      cases/page.tsx              PAGE 05
      rules/page.tsx              PAGE 07
      scenarios/page.tsx          PAGE 08  (PREVIEW)
      environments/page.tsx       PAGE 10  (PREVIEW)
      variables/page.tsx          PAGE 11  (PREVIEW)
      traffic/page.tsx            PAGE 09  (PREVIEW)
      public/page.tsx             PAGE 13
      settings/page.tsx           PAGE 14  (tabs via ?tab=)
    traffic/page.tsx              workspace-level traffic (PREVIEW)
    endpoints/page.tsx            workspace-level all-endpoints (REAL, cross-project)
```

- Endpoint Workspace (source spec §10, the hero) is the `endpoints` route with an
  endpoint selected: `/p/<slug>/endpoints?e=<endpointKey>&c=<caseId>`. Three
  columns; deep-linkable; browser back works.
- Root `page.tsx` becomes `redirect("/projects")`. The `<noscript>` project list
  moves into `app/(app)/layout.tsx` as a server-rendered fallback.
- Unknown `/p/<slug>` → `notFound()`.

## 5. Component architecture

`app/_ui/` — primitives (no dependency, ~1 file each):
`Button`, `Input`, `Select`, `Tabs`, `Drawer`, `Modal`, `Dropdown`, `Tooltip`,
`Toast`, `Badge`, `Kbd`, `EmptyState`, `Skeleton`, `MethodPill`, `StatusCode`,
`JsonView` (line numbers + minimal JSON syntax classes; no highlighter lib),
`CopyButton`.

`app/_shell/`:
`AppShell`, `TopBar`, `Sidebar`, `ProjectSwitcher`, `PageHeader`, `Breadcrumbs`,
`CommandPalette`, `GlobalSearch`, `PreviewBadge`.

`app/_features/`:
- `projects/` — `ProjectGrid`, `ProjectCard`, `ProjectListRow`, `ProjectEmptyState`, `CreateProjectModal`
- `endpoints/` — `EndpointList`, `EndpointRow`, `EndpointWorkspace`, `EndpointToolbar`
- `cases/` — `CaseList`, `CaseRow`, `CaseDetail`, `CreateCaseModal`
- `runner/` — `RequestBuilder`, `RequestTabs`, `HeadersEditor`, `BodyEditor`, `ResponseViewer`, `VerdictLine`, `CodeGenerator`
- `rules/` — `RuleList`, `RuleCard`, `RuleBuilder`, `ConditionRow` (`RuleBuilder` = PREVIEW)
- `traffic/` — `TrafficTable`, `TrafficRow`, `TrafficDrawer` (PREVIEW)
- `scenarios/` — `ScenarioCanvas`, `ScenarioNode`, `ScenarioConnector`, `ScenarioToolbar` (PREVIEW)
- `settings/` — `SettingsTabs`, `EnvironmentList`, `VariableTable`, `PublicServerPanel`

Existing `app/_explorer/*` is deleted. Salvage into the new tree:
- `Runner.tsx` logic → `runner/RequestBuilder` + `runner/ResponseViewer`
- `EndpointList.tsx`, `CaseList.tsx` keyboard nav → new `endpoints/`, `cases/`
- `status.ts`, `format.ts`, `endpointLabel.ts`, `trace.ts` (verdict text only —
  drop the SVG geometry), `ThemeToggle.tsx` → move under `app/_ui/` / `app/_lib/`
- their `*.test.ts` move with them, assertions unchanged

`src/viewer/{model,curl,verdict}.ts` stay where they are — pure, tested, backend-adjacent.

## 6. Design tokens

One file: `app/tokens.css` (imported by `globals.css`). Replaces the ad-hoc
`--ground/--panel/--ink` set. Conceptual tokens from source spec §31:

```
--bg --surface --surface-elevated --border
--text --text-secondary --text-muted
--accent --accent-hover --success --warning --error --info
--radius-sm(6) --radius-md(8) --radius-lg(10)
--space-1..8   --font-ui(Inter)   --font-mono(JetBrains Mono)
--transition(160ms ease)   --z-drawer --z-modal --z-palette
```

Themes: `:root` (Obsidian, default) and `:root[data-theme="paper"]` (light).
Aurora is deferred — token slots exist, no values shipped. `next/font`: swap
Chivo → Inter, IBM Plex Mono → JetBrains Mono (both Google fonts, same mechanism
as today). No component hardcodes a hex value. The `.mx-*` classes are removed
with `app/_explorer/`.

## 7. PREVIEW state

`app/_lib/preview-store.tsx` — a React context, one provider mounted in
`(app)/layout.tsx`:

```ts
interface PreviewState {
  environments: Env[];          // seeded: Local / Dev / QA / Prod
  activeEnvId: string;
  variables: Variable[];
  scenarios: Record<string /*slug*/, Scenario[]>;
  rulesDraft: Record<string /*endpointKey*/, DraftRule[]>;
}
```

- Persisted to `sessionStorage` under one key; try/catch on read and write;
  renders correctly with nothing stored.
- Never merged into `ViewModel`, never posted anywhere.
- `activeEnv` only rewrites the URL the runner pre-fills and the cURL string —
  the actual `fetch` still targets whatever is in the field, so Execute against a
  non-local env just fails at the network layer, honestly.
- `<PreviewBadge/>` renders on every PREVIEW page header.

## 8. Runner changes (REAL, behavior-preserving)

Keep `execute()` verbatim: same `fetch`, same `noBody` rule, same
`classifyResult`, same timing. Changes are presentational:
- method/url row, tabbed request (Params / Headers / Auth / Body / Pre-request —
  Params, Auth, Pre-request are PREVIEW tabs, empty-with-note),
- `BodyEditor`: textarea + line-number gutter + Format (JSON.parse/stringify) +
  Copy + Reset; invalid JSON shows an inline marker, does not block Execute
  (matches current lenient behavior),
- `ResponseViewer`: status / duration / size (`new Blob([bodyText]).size`),
  Body / Headers / Raw tabs, Pretty/Raw toggle,
- `CodeGenerator`: cURL tab renders `renderCurl` output unchanged; other tabs
  render a "coming soon" panel.
- `⌘↵` executes when focus is in the runner; `⌘⇧C` copies cURL. Shortcuts are
  ignored while typing in a text input, except the body editor + `⌘↵`.

## 9. Accessibility & responsive

- Keyboard: roving tabindex in every list (salvaged from `EndpointList`), `Esc`
  closes drawer / modal / palette, visible `:focus-visible` ring (token'd),
  icon-only buttons get `aria-label` + `Tooltip`.
- Command palette: `role="dialog"`, focus trap, arrow-key nav, `⌘K` / `Ctrl K`.
- Responsive (source spec §28): sidebar → collapsible drawer under 960px; the
  three workspace columns → tabs under 960px (the current `data-collapsed`
  pattern, generalized); tables → stacked rows under 720px.
- `prefers-reduced-motion`: transitions drop to 0ms (one media query in tokens).

## 10. Testing

- **Preserve** every existing test under `app/_explorer/*.test.ts` and
  `src/**/*.test.ts` — move the explorer ones with their code, keep assertions.
- **Add** (vitest, jsdom — already the setup):
  - `preview-store` — seed, persist, reload-from-empty, isolation from ViewModel
  - `BodyEditor` format — valid pretties, invalid left as-is + marker
  - `ResponseViewer` size calc; status-class mapping (reuse `status.ts` tests)
  - `CommandPalette` — filter matches projects/endpoints/cases; REAL command
    fires handler, PREVIEW command shows tag
  - `GlobalSearch` — query → grouped results from a fixture `ViewModel`
  - `activeEnv` URL rewrite is pure and reversible
- `npm run check` (compile + tsc + eslint + vitest) stays green — the gate.
- Manual QA checklist (source spec §37): every card-block-lost endpoint selects
  and executes; cases load; body edit works; Execute works; cURL copy works;
  both themes readable; deep links resolve.

## 11. Risk / mitigation

- **Scope.** 16 screens is large. Build in the source spec's phase order (§12)
  behind the shell; each phase is independently shippable and leaves
  `npm run check` green. One branch, multiple commits.
- **Regressing the runner.** Lift `execute()` and its helpers unchanged; the
  existing runner tests must pass without edits.
- **Route layout churn in Next 15.** One `(app)` group, one `ViewModel` build in
  its layout, everything else a leaf client page.
- **PREVIEW mistaken for real.** `<PreviewBadge/>` on page headers,
  disabled+tooltip on non-functional actions, `sessionStorage` (dies with the
  tab), copy that says "preview".

## 12. Phase plan (maps to source spec §36)

1. Tokens + `next/font` swap + `AppShell` (TopBar, Sidebar, ProjectSwitcher) +
   `/projects` + routing skeleton + root redirect. Delete `app/_explorer/` last,
   once parity exists.
2. `/p/[slug]` overview + endpoints list + **Endpoint Workspace** (3 col) + cases
   + runner + response + code-gen. Runner parity check here.
3. Command palette + global search + keyboard shortcuts + Toast / Drawer / Modal
   / Skeleton polish + empty / loading / error states.
4. Traffic + traffic drawer + environments + variables (all PREVIEW,
   `preview-store`).
5. Rules (read REAL + build PREVIEW) + Scenario Builder (PREVIEW) + Public Mock
   Server + Settings.
6. Paper theme pass + responsive (sidebar drawer, column tabs, stacked tables) +
   a11y sweep + perf (debounced search; list virtualization only if a list
   actually exceeds ~200 rows).

Each phase: its own commit(s), `npm run check` green, on branch
`feat/obsidian-redesign`, one PR at the end.
