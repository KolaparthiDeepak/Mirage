# MOCKSERVERS Obsidian Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the MOCKSERVERS UI into a routed premium developer tool (Obsidian Midnight theme, 16 screens) without touching the mock backend.

**Architecture:** Next.js App Router with an `(app)` route group. One server layout builds the `ViewModel` from `mocks.generated.json` and provides it via React context; every page is a leaf client component. A separate `preview-store` context holds isolated, `sessionStorage`-backed state for features the backend does not support. The existing request-runner logic (`fetch` + verdict) is lifted verbatim into new presentational components.

**Tech Stack:** Next.js 15.5, React 19, TypeScript 5.7, plain CSS with custom-property tokens, `next/font/google` (Inter + JetBrains Mono), Vitest + jsdom. No new runtime dependencies.

**Design doc:** `docs/specs/2026-08-30-mockservers-obsidian-redesign-design.md`
**Source spec:** `docs/specs/2026-08-29-mockservers-luxury-ui-source-spec.md`

## Global Constraints

- **Node ≥ 20** (`package.json` engines). Use `nvm use 22` locally.
- **No new runtime dependencies.** One dev-dependency exception is allowed for component testing (`@testing-library/react` + `@testing-library/dom`) — check `package.json` first, add only if absent, note it in that commit. Nothing else.
- **Backend is frozen:** never edit `src/engine/*`, `src/compile/*`, `src/openapi/*`, `src/viewer/{model,curl,verdict}.ts`, `app/m/[...slug]/route.ts`, `app/%5F%5Fmock/*`, `mocks/**`, `mocks.generated.json`, `scripts/*`, `next.config.mjs`, `vercel.json`.
- **`npm run check` must pass** at the end of every task (compile + `tsc --noEmit` + `eslint .` + `vitest run`, in sequence).
- **Do not rename `app/%5F%5Fmock/`.** Next treats `_`-prefixed folders as non-routable.
- **All work on branch `feat/obsidian-redesign`.** Conventional Commits. Repo-local git identity (`Deepak Kolaparthi <KolaparthiDeepak@users.noreply.github.com>`). No direct commits to `main`.
- **Commit trailer:** end every commit message with `Claude-Session: https://claude.ai/code/session_01MuK2fgcpXNhze3JYKrBSo5`.
- **REAL vs PREVIEW:** a control is REAL (wired to backend / router) or PREVIEW (isolated local state + visible `<PreviewBadge/>` + `sessionStorage`). Never a silent no-op. Never persist PREVIEW data anywhere but `sessionStorage`. See design doc §3.
- **Tokens only:** no hardcoded hex in any component. All color / space / radius / z-index from `app/tokens.css` custom properties.
- **Theme:** `:root` = Obsidian (default dark). `:root[data-theme="paper"]` = light. `prefers-reduced-motion` zeroes transitions.
- **Colors (Obsidian, verbatim from source spec §1):** bg `#0B0C0F`, surface `#111318`, surface-elevated `#17191F`, border `#252831`, text `#F5F5F2`, text-secondary `#8B909B`, text-muted `#626773`, accent `#A78BFA`, accent-hover `#B59AFB`, success `#46C88A`, warning `#E8B85C`, error `#EF6B73`, info `#6EA8FE`.
- **Radius:** 6–10px. **Transitions:** 150–200ms. **Typography:** Inter for UI, JetBrains Mono for paths / methods / JSON / status / URLs.

---

## File Structure

### Created

```
app/tokens.css                         design tokens (all custom properties)
app/_lib/
  view-model-context.tsx               ViewModel context; useViewModel(), useProject(slug)
  preview-store.tsx                     PreviewProvider + usePreview(); sessionStorage-backed
  theme.ts                             getTheme/setTheme/toggleTheme (from _explorer/ThemeToggle)
  format.ts                            prettyBody, parseHeaderLines, renderCurl, verdictText (moved)
  status.ts                            statusClass, statusKind (moved)
  endpoint-label.ts                    commandCode (moved from _explorer/endpointLabel.ts)
  search.ts                            searchViewModel(model, query) -> grouped results
  env-url.ts                           applyEnv(url, env) / stripEnv(url) — pure base-URL rewrite
  use-debounced.ts                     useDebounced(value, ms)
app/_ui/
  Button Input Select Tabs Drawer Modal Dropdown Tooltip Toast Badge Kbd
  EmptyState Skeleton MethodPill StatusCode JsonView CopyButton  (+ index.ts, ui.module.css)
app/_shell/
  AppShell TopBar Sidebar ProjectSwitcher PageHeader Breadcrumbs PreviewBadge
  CommandPalette GlobalSearch  (+ shell.module.css)
app/_features/
  projects/   ProjectGrid ProjectCard ProjectListRow ProjectEmptyState CreateProjectModal
  endpoints/  EndpointList EndpointRow EndpointToolbar EndpointWorkspace
  cases/      CaseList CaseRow CaseDetail CreateCaseModal
  runner/     RequestBuilder RequestTabs HeadersEditor BodyEditor ResponseViewer VerdictLine CodeGenerator
  rules/      RuleList RuleCard RuleBuilder ConditionRow
  traffic/    TrafficTable TrafficRow TrafficDrawer sample-traffic.ts
  scenarios/  ScenarioCanvas ScenarioNode ScenarioConnector ScenarioToolbar
  settings/   SettingsTabs EnvironmentList VariableTable PublicServerPanel
app/(app)/
  layout.tsx
  projects/page.tsx   endpoints/page.tsx   traffic/page.tsx
  p/[slug]/layout.tsx  p/[slug]/page.tsx
  p/[slug]/{endpoints,cases,rules,scenarios,environments,variables,traffic,public,settings}/page.tsx
```

### Modified

```
app/layout.tsx     swap Chivo->Inter, IBM_Plex_Mono->JetBrains_Mono; keep theme script
app/globals.css    import ./tokens.css; strip .mx-* rules; keep resets + base
app/page.tsx       becomes redirect("/projects") (+ server <noscript> project list)
```

### Deleted (Task 11)

```
app/_explorer/      entire directory — logic salvaged into _features/, _lib/, _ui/
```

Tests move with their code: `_explorer/format.test.ts` -> `_lib/format.test.ts`, `_explorer/status.test.ts` -> `_lib/status.test.ts`, `_explorer/trace.test.ts` verdict cases -> `_lib/format.test.ts`. `src/**/*.test.ts` untouched.

---

# PHASE 1 — Shell, tokens, routing, Projects page

Fully specified below. Phases 2–6 are task inventories (after Phase 1); each is expanded to bite-sized TDD steps by its own follow-up planning pass before execution, matching the design doc's six-phase split (each phase is independently shippable, `npm run check` green).

### Task 0: Test infrastructure for component tests

**Why:** `vitest.config.ts` currently sets `environment: "node"` and no DOM / component-testing libs are installed. Tasks 3, 4, 6, 7, 8, 10 render React components in tests. This task adds the minimum to make that possible — the one dependency exception named in Global Constraints.

**Files:**
- Modify: `vitest.config.ts` (`environment: "node"` → `"jsdom"`)
- Modify: `package.json`, `package-lock.json` (add devDeps)
- Test: `app/_lib/smoke.test.tsx`

**Interfaces:**
- Produces: a jsdom test environment; `@testing-library/react` `render` / `screen` available to every later task.

- [ ] **Step 1: Add dev dependencies**

Run: `nvm use 22 && npm i -D jsdom @testing-library/react @testing-library/dom`
(These three are the entirety of the "one dev-dependency exception" from Global Constraints. No `@testing-library/jest-dom` — tests use `toBeDefined()` / `.textContent` / DOM property assertions only.)

- [ ] **Step 2: Write the failing test**

```tsx
// app/_lib/smoke.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

describe("test infra", () => {
  it("renders a React component into jsdom", () => {
    render(<button>hello</button>);
    expect(screen.getByRole("button", { name: "hello" })).toBeDefined();
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run app/_lib/smoke.test.tsx`
Expected: FAIL — `document is not defined` (still `environment: "node"`).

- [ ] **Step 4: Flip the environment**

In `vitest.config.ts` change `environment: "node"` to `environment: "jsdom"`. Leave `include`, `exclude`, `passWithNoTests`, and the `@` alias exactly as they are.

- [ ] **Step 5: Run the full suite**

Run: `npx vitest run`
Expected: PASS — the new smoke test plus every pre-existing `src/**` and `app/**` test (70 tests as of branch start), all green under jsdom.

- [ ] **Step 6: Commit**

```bash
git add vitest.config.ts package.json package-lock.json app/_lib/smoke.test.tsx
git commit -m "test: jsdom environment + React Testing Library for component tests

Claude-Session: https://claude.ai/code/session_01MuK2fgcpXNhze3JYKrBSo5"
```

---

### Task 1: Design tokens

**Files:**
- Create: `app/tokens.css`
- Modify: `app/globals.css`
- Test: `app/_lib/tokens.test.ts`

**Interfaces:**
- Produces: CSS custom properties on `:root` and `:root[data-theme="paper"]` — the palette names in Global Constraints plus `--radius-sm|md|lg`, `--space-1..8`, `--font-ui`, `--font-mono`, `--transition`, `--z-drawer|modal|palette`.

- [ ] **Step 1: Write the failing test**

```ts
// app/_lib/tokens.test.ts
import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";

const css = readFileSync(new URL("../tokens.css", import.meta.url), "utf8");

describe("tokens.css", () => {
  it("defines the Obsidian palette on :root verbatim from the spec", () => {
    for (const [name, hex] of [
      ["--bg", "#0B0C0F"], ["--surface", "#111318"], ["--surface-elevated", "#17191F"],
      ["--border", "#252831"], ["--text", "#F5F5F2"], ["--text-secondary", "#8B909B"],
      ["--text-muted", "#626773"], ["--accent", "#A78BFA"], ["--accent-hover", "#B59AFB"],
      ["--success", "#46C88A"], ["--warning", "#E8B85C"], ["--error", "#EF6B73"], ["--info", "#6EA8FE"],
    ]) {
      expect(css).toMatch(new RegExp(`${name}\\s*:\\s*${hex}`, "i"));
    }
  });
  it("defines a paper (light) theme override", () => {
    expect(css).toMatch(/:root\[data-theme="paper"\]/);
  });
  it("zeroes transitions under reduced motion", () => {
    expect(css).toMatch(/prefers-reduced-motion/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/_lib/tokens.test.ts`
Expected: FAIL — `ENOENT` on `tokens.css`.

- [ ] **Step 3: Write `app/tokens.css`**

```css
:root {
  --bg: #0B0C0F;
  --surface: #111318;
  --surface-elevated: #17191F;
  --border: #252831;
  --text: #F5F5F2;
  --text-secondary: #8B909B;
  --text-muted: #626773;
  --accent: #A78BFA;
  --accent-hover: #B59AFB;
  --success: #46C88A;
  --warning: #E8B85C;
  --error: #EF6B73;
  --info: #6EA8FE;

  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 10px;

  --space-1: 4px;  --space-2: 8px;  --space-3: 12px; --space-4: 16px;
  --space-5: 20px; --space-6: 24px; --space-7: 32px; --space-8: 48px;

  --font-ui: var(--font-inter), system-ui, -apple-system, sans-serif;
  --font-mono: var(--font-jetbrains), ui-monospace, "SF Mono", Menlo, monospace;

  --transition: 160ms ease;

  --z-drawer: 40;
  --z-modal: 50;
  --z-palette: 60;

  color-scheme: dark;
}

:root[data-theme="paper"] {
  --bg: #FBFAF7;
  --surface: #FFFFFF;
  --surface-elevated: #F4F1EA;
  --border: #E4DECF;
  --text: #23201B;
  --text-secondary: #6B6459;
  --text-muted: #948C7E;
  --accent: #7C5CFA;
  --accent-hover: #6A47F0;
  --success: #2F9463;
  --warning: #B07D1F;
  --error: #C4483F;
  --info: #3B6FD6;
  color-scheme: light;
}

@media (prefers-reduced-motion: reduce) {
  :root { --transition: 0ms; }
}
```

- [ ] **Step 4: Rewrite `app/globals.css`** to:

```css
@import "./tokens.css";

* { box-sizing: border-box; min-width: 0; }
html, body { margin: 0; padding: 0; height: 100%; }
body {
  background: var(--bg);
  color: var(--text);
  font-family: var(--font-ui);
  font-size: 13px;
  line-height: 1.55;
  -webkit-font-smoothing: antialiased;
  transition: background-color var(--transition), color var(--transition);
}
:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
code, pre, .mono { font-family: var(--font-mono); }
img { max-width: 100%; }
[hidden] { display: none !important; }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run app/_lib/tokens.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add app/tokens.css app/globals.css app/_lib/tokens.test.ts
git commit -m "feat(ui): Obsidian Midnight design tokens

Claude-Session: https://claude.ai/code/session_01MuK2fgcpXNhze3JYKrBSo5"
```

---

### Task 2: Font swap

**Files:**
- Modify: `app/layout.tsx`
- Test: `app/layout.test.tsx`

**Interfaces:**
- Produces: `--font-inter` and `--font-jetbrains` CSS variables on `<html>` (consumed by `tokens.css` `--font-ui` / `--font-mono`).

- [ ] **Step 1: Write the failing test**

```tsx
// app/layout.test.tsx
import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
const src = readFileSync(new URL("./layout.tsx", import.meta.url), "utf8");

describe("root layout", () => {
  it("loads Inter and JetBrains Mono from next/font/google", () => {
    expect(src).toMatch(/from "next\/font\/google"/);
    expect(src).toMatch(/Inter\(/);
    expect(src).toMatch(/JetBrains_Mono\(/);
  });
  it("exposes them as --font-inter / --font-jetbrains", () => {
    expect(src).toMatch(/--font-inter/);
    expect(src).toMatch(/--font-jetbrains/);
  });
  it("keeps the pre-paint theme script", () => {
    expect(src).toMatch(/localStorage\.getItem\('mockservers-theme'\)/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/layout.test.tsx`
Expected: FAIL — still references `Chivo` / `IBM_Plex_Mono`.

- [ ] **Step 3: Edit `app/layout.tsx`** — replace the font imports/consts:

```tsx
import { Inter, JetBrains_Mono } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-jetbrains",
  display: "swap",
});
```

Set `<html>` className to `` `${inter.variable} ${jetbrains.variable}` ``. Keep the `themeScript` const, the `<script dangerouslySetInnerHTML>`, `suppressHydrationWarning`, and `import "./globals.css"` exactly as they are. Update `metadata.title` to `"MOCKSERVERS"`.

- [ ] **Step 4: Run test + typecheck**

Run: `npx vitest run app/layout.test.tsx && npx tsc --noEmit`
Expected: PASS, no type errors.

- [ ] **Step 5: Commit**

```bash
git add app/layout.tsx app/layout.test.tsx
git commit -m "feat(ui): swap fonts to Inter + JetBrains Mono

Claude-Session: https://claude.ai/code/session_01MuK2fgcpXNhze3JYKrBSo5"
```

---

### Task 3: ViewModel context

**Files:**
- Create: `app/_lib/view-model-context.tsx`
- Test: `app/_lib/view-model-context.test.tsx`

**Interfaces:**
- Consumes: `ViewModel`, `ProjectVM` from `@/src/viewer/model` (frozen — do not modify).
- Produces:
  - `<ViewModelProvider model={ViewModel}>{children}</ViewModelProvider>`
  - `useViewModel(): ViewModel`
  - `useProject(slug: string): ProjectVM | null`

- [ ] **Step 1: Write the failing test**

```tsx
// app/_lib/view-model-context.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ViewModelProvider, useViewModel, useProject } from "./view-model-context";
import type { ViewModel } from "@/src/viewer/model";

const model: ViewModel = {
  build: { commit: "abc", builtAt: "2026-08-30", warnings: [] },
  projects: [{ slug: "card-block-lost", name: "Card Block", endpoints: [], caseCount: 0 }],
};

function Probe({ slug }: { slug: string }) {
  const vm = useViewModel();
  const p = useProject(slug);
  return <div>{vm.projects.length}:{p?.name ?? "none"}</div>;
}

describe("view-model-context", () => {
  it("provides the model and resolves a project by slug", () => {
    render(<ViewModelProvider model={model}><Probe slug="card-block-lost" /></ViewModelProvider>);
    expect(screen.getByText("1:Card Block")).toBeDefined();
  });
  it("returns null for an unknown slug", () => {
    render(<ViewModelProvider model={model}><Probe slug="nope" /></ViewModelProvider>);
    expect(screen.getByText("1:none")).toBeDefined();
  });
});
```

> Test infra (jsdom + `@testing-library/react`) is set up in Task 0. Assertions use `toBeDefined()` / DOM properties only — no jest-dom matchers.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/_lib/view-model-context.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```tsx
// app/_lib/view-model-context.tsx
"use client";
import { createContext, useContext, type ReactNode } from "react";
import type { ViewModel, ProjectVM } from "@/src/viewer/model";

const Ctx = createContext<ViewModel | null>(null);

export function ViewModelProvider({ model, children }: { model: ViewModel; children: ReactNode }) {
  return <Ctx.Provider value={model}>{children}</Ctx.Provider>;
}

export function useViewModel(): ViewModel {
  const v = useContext(Ctx);
  if (!v) throw new Error("useViewModel must be used inside <ViewModelProvider>");
  return v;
}

export function useProject(slug: string): ProjectVM | null {
  return useViewModel().projects.find((p) => p.slug === slug) ?? null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/_lib/view-model-context.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add app/_lib/view-model-context.tsx app/_lib/view-model-context.test.tsx
git commit -m "feat(app): ViewModel React context

Claude-Session: https://claude.ai/code/session_01MuK2fgcpXNhze3JYKrBSo5"
```

---

### Task 4: preview-store

**Files:**
- Create: `app/_lib/preview-store.tsx`
- Test: `app/_lib/preview-store.test.tsx`

**Interfaces:**
- Produces:
  - `Env { id: string; name: string; baseUrl: string }`
  - `Variable { id: string; key: string; value: string; scope: "Global" | "Project" | "QA" | "Local" }`
  - `ScenarioStep { id: string; endpointKey: string; expectedStatus: number }`
  - `Scenario { id: string; name: string; steps: ScenarioStep[] }`
  - `DraftRule { id: string; field: string; op: string; value: string; caseId: string }`
  - `PreviewState { environments: Env[]; activeEnvId: string; variables: Variable[]; scenarios: Record<string, Scenario[]>; rulesDraft: Record<string, DraftRule[]> }`
  - `<PreviewProvider>{children}</PreviewProvider>`
  - `usePreview(): { state: PreviewState; set: (updater: (s: PreviewState) => PreviewState) => void; activeEnv: Env }`
  - `SEED_ENVIRONMENTS: Env[]`

- [ ] **Step 1: Write the failing test**

```tsx
// app/_lib/preview-store.test.tsx
import { render, screen, act } from "@testing-library/react";
import { beforeEach, describe, it, expect } from "vitest";
import { PreviewProvider, usePreview, SEED_ENVIRONMENTS } from "./preview-store";

function Probe() {
  const { state, set, activeEnv } = usePreview();
  return (
    <div>
      <span data-testid="count">{state.environments.length}</span>
      <span data-testid="active">{activeEnv.name}</span>
      <button onClick={() => set((s) => ({ ...s, variables: [...s.variables, { id: "1", key: "K", value: "V", scope: "Global" }] }))}>add</button>
      <span data-testid="vars">{state.variables.length}</span>
    </div>
  );
}

beforeEach(() => { try { sessionStorage.clear(); } catch { /* jsdom */ } });

describe("preview-store", () => {
  it("seeds environments and renders with empty storage", () => {
    render(<PreviewProvider><Probe /></PreviewProvider>);
    expect(screen.getByTestId("count").textContent).toBe(String(SEED_ENVIRONMENTS.length));
    expect(screen.getByTestId("active").textContent).toBe("Local");
  });
  it("persists a change to sessionStorage", () => {
    render(<PreviewProvider><Probe /></PreviewProvider>);
    act(() => { screen.getByText("add").click(); });
    expect(screen.getByTestId("vars").textContent).toBe("1");
    const raw = sessionStorage.getItem("mockservers-preview");
    expect(raw && JSON.parse(raw).variables.length).toBe(1);
  });
  it("rehydrates from existing storage", () => {
    sessionStorage.setItem("mockservers-preview", JSON.stringify({
      environments: SEED_ENVIRONMENTS, activeEnvId: SEED_ENVIRONMENTS[0].id,
      variables: [{ id: "x", key: "A", value: "B", scope: "Global" }], scenarios: {}, rulesDraft: {},
    }));
    render(<PreviewProvider><Probe /></PreviewProvider>);
    expect(screen.getByTestId("vars").textContent).toBe("1");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/_lib/preview-store.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```tsx
// app/_lib/preview-store.tsx
"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

export interface Env { id: string; name: string; baseUrl: string }
export interface Variable { id: string; key: string; value: string; scope: "Global" | "Project" | "QA" | "Local" }
export interface ScenarioStep { id: string; endpointKey: string; expectedStatus: number }
export interface Scenario { id: string; name: string; steps: ScenarioStep[] }
export interface DraftRule { id: string; field: string; op: string; value: string; caseId: string }

export interface PreviewState {
  environments: Env[];
  activeEnvId: string;
  variables: Variable[];
  scenarios: Record<string, Scenario[]>;
  rulesDraft: Record<string, DraftRule[]>;
}

export const SEED_ENVIRONMENTS: Env[] = [
  { id: "local", name: "Local", baseUrl: "http://localhost:3000" },
  { id: "dev", name: "Development", baseUrl: "https://dev.mockservers.dailyuze.com" },
  { id: "qa", name: "QA", baseUrl: "https://qa.mockservers.dailyuze.com" },
  { id: "prod", name: "Production", baseUrl: "https://mockservers.dailyuze.com" },
];

const KEY = "mockservers-preview";

function initial(): PreviewState {
  return { environments: SEED_ENVIRONMENTS, activeEnvId: "local", variables: [], scenarios: {}, rulesDraft: {} };
}

function load(): PreviewState {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return initial();
    const parsed = JSON.parse(raw) as Partial<PreviewState>;
    return { ...initial(), ...parsed };
  } catch {
    return initial();
  }
}

interface Api { state: PreviewState; set: (updater: (s: PreviewState) => PreviewState) => void; activeEnv: Env }
const Ctx = createContext<Api | null>(null);

export function PreviewProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PreviewState>(initial);
  const hydrated = useRef(false);

  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    setState(load());
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    try { sessionStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode / jsdom */ }
  }, [state]);

  const set = useCallback((updater: (s: PreviewState) => PreviewState) => setState(updater), []);
  const activeEnv = state.environments.find((e) => e.id === state.activeEnvId) ?? state.environments[0];

  return <Ctx.Provider value={{ state, set, activeEnv }}>{children}</Ctx.Provider>;
}

export function usePreview(): Api {
  const v = useContext(Ctx);
  if (!v) throw new Error("usePreview must be used inside <PreviewProvider>");
  return v;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/_lib/preview-store.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add app/_lib/preview-store.tsx app/_lib/preview-store.test.tsx
git commit -m "feat(app): preview-store for backend-unsupported features

Claude-Session: https://claude.ai/code/session_01MuK2fgcpXNhze3JYKrBSo5"
```

---

### Task 5: Move shared helpers into `_lib`

**Files:**
- Create: `app/_lib/format.ts`, `app/_lib/status.ts`, `app/_lib/endpoint-label.ts`, `app/_lib/theme.ts`, `app/_lib/use-debounced.ts`
- Create (moved): `app/_lib/format.test.ts`, `app/_lib/status.test.ts`
- Note: `app/_explorer/*` stays until Task 11; new files hold the moved bodies (not re-exports).

**Interfaces:**
- Produces: `prettyBody(text: string): string`, `parseHeaderLines(text: string): Record<string,string>`, `renderCurl(curl): string`, `verdictText(v): { text: string; cls: string }` (`format.ts`); `statusClass(code: number): string`, `statusKind(code: number): "2"|"4"|"5"|"x"` (`status.ts`); `commandCode(path: string): string` (`endpoint-label.ts`); `getTheme(): "paper"|"obsidian"`, `setTheme(t): void`, `toggleTheme(): void` (`theme.ts`); `useDebounced<T>(value: T, ms: number): T` (`use-debounced.ts`).

- [ ] **Step 1** Copy `app/_explorer/format.ts` -> `app/_lib/format.ts` verbatim (imports of `@/src/viewer/*` are absolute — unchanged). Copy `app/_explorer/format.test.ts` -> `app/_lib/format.test.ts`, change the import to `./format`.
- [ ] **Step 2** Same for `status.ts` + `status.test.ts`; `endpointLabel.ts` -> `endpoint-label.ts` (rename the file, keep the export name `commandCode`).
- [ ] **Step 3** Extract theme read/write/toggle from `app/_explorer/ThemeToggle.tsx` into `app/_lib/theme.ts`: `localStorage` key `"mockservers-theme"`, stored value `"paper"` or absent, default from `matchMedia("(prefers-color-scheme: light)")`; all in try/catch; `setTheme` also sets `document.documentElement.dataset.theme`.
- [ ] **Step 4** Write `app/_lib/use-debounced.ts` (`useState` + `useEffect` + `setTimeout`/`clearTimeout`) and a 2-case test with `vi.useFakeTimers()`.
- [ ] **Step 5: Run** `npx vitest run app/_lib/` — Expected: PASS, moved tests green.
- [ ] **Step 6: Commit**

```bash
git add app/_lib
git commit -m "refactor(app): move shared helpers to app/_lib

Claude-Session: https://claude.ai/code/session_01MuK2fgcpXNhze3JYKrBSo5"
```

---

### Task 6: UI primitives — Button, Input, Badge, Kbd, MethodPill, StatusCode, CopyButton

**Files:**
- Create: `app/_ui/Button.tsx`, `Input.tsx`, `Badge.tsx`, `Kbd.tsx`, `MethodPill.tsx`, `StatusCode.tsx`, `CopyButton.tsx`, `index.ts`, `ui.module.css`
- Test: `app/_ui/primitives.test.tsx`

**Interfaces:**
- Produces:
  - `<Button variant="primary"|"secondary"|"ghost" size?="sm"|"md" {...React.ButtonHTMLAttributes}/>` — sets `data-variant`
  - `<Input mono?: boolean {...React.InputHTMLAttributes}/>`
  - `<Badge tone="neutral"|"success"|"warning"|"error"|"info">` — sets `data-tone`
  - `<Kbd>{children}</Kbd>`
  - `<MethodPill method: string/>` — `data-tone`: GET->success, POST->info, PUT|PATCH->warning, DELETE->error, else neutral
  - `<StatusCode code: number/>` — mono span, className from `statusClass(code)`
  - `<CopyButton text: string label?="Copy"/>` — `navigator.clipboard.writeText`, 1200ms "Copied" state

- [ ] **Step 1: Write the failing test**

```tsx
// app/_ui/primitives.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { Button, MethodPill, StatusCode, Badge } from "./index";

describe("ui primitives", () => {
  it("Button renders its variant as a data attribute and fires onClick", () => {
    const onClick = vi.fn();
    render(<Button variant="primary" onClick={onClick}>Go</Button>);
    const b = screen.getByRole("button", { name: "Go" });
    expect(b.dataset.variant).toBe("primary");
    b.click();
    expect(onClick).toHaveBeenCalledOnce();
  });
  it("MethodPill maps POST to the info tone", () => {
    render(<MethodPill method="POST" />);
    expect(screen.getByText("POST").dataset.tone).toBe("info");
  });
  it("StatusCode maps 404 to a 4xx class", () => {
    render(<StatusCode code={404} />);
    expect(screen.getByText("404").className).toMatch(/4/);
  });
  it("Badge renders tone", () => {
    render(<Badge tone="success">ok</Badge>);
    expect(screen.getByText("ok").dataset.tone).toBe("success");
  });
});
```

- [ ] **Step 2: Run** — FAIL, `./index` missing.
- [ ] **Step 3: Implement** each as a small function component; all styling in `ui.module.css` referencing tokens only (e.g. `.btn[data-variant="primary"]{background:var(--accent);color:var(--bg);border-radius:var(--radius-sm);transition:var(--transition)}`). `index.ts` re-exports all seven. `StatusCode` reuses `statusClass` from `@/app/_lib/status`.
- [ ] **Step 4: Run** `npx vitest run app/_ui/primitives.test.tsx` — PASS (4).
- [ ] **Step 5: Commit**

```bash
git add app/_ui
git commit -m "feat(ui): base primitives (Button, Input, Badge, Kbd, MethodPill, StatusCode, CopyButton)

Claude-Session: https://claude.ai/code/session_01MuK2fgcpXNhze3JYKrBSo5"
```

---

### Task 7: UI primitives — Modal, Drawer, Tooltip, Tabs, EmptyState, Skeleton, Dropdown, Toast, Select, JsonView

**Files:**
- Create: the ten component files in `app/_ui/`; extend `index.ts` and `ui.module.css`
- Test: `app/_ui/overlays.test.tsx`, `app/_ui/json-view.test.tsx`

**Interfaces:**
- Produces:
  - `<Modal open: boolean onClose: () => void title: string children/>` — `role="dialog"` `aria-modal`, `Esc` -> `onClose`, backdrop click -> `onClose`, focus trap, visibility via `hidden` attr not `display`
  - `<Drawer open onClose side?="right" children/>` — same semantics, slide transition `var(--transition)`
  - `<Tooltip label: string children/>` — hover + focus, `aria-describedby`
  - `<Tabs tabs: {id: string; label: string}[] active: string onChange: (id: string) => void/>` — `role="tablist"`, arrow-key roving
  - `<Select {...React.SelectHTMLAttributes}/>`
  - `<EmptyState icon?: ReactNode title: string body?: string action?: ReactNode/>`
  - `<Skeleton width?: string height?: string/>`
  - `<Dropdown trigger: ReactNode items: {label: string; onSelect: () => void; disabled?: boolean}[]/>`
  - `<ToastProvider>{children}</ToastProvider>` + `useToast(): (msg: string) => void`
  - `<JsonView value: string showLineNumbers?: boolean/>` — `JSON.parse`; on success render pretty with token spans `.j-key .j-str .j-num .j-bool .j-null`; on failure render `value` verbatim in a `<pre data-invalid>`; outer wrapper `overflow-x:auto`

- [ ] **Step 1: Write failing tests**

```tsx
// app/_ui/overlays.test.tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { Modal } from "./index";

describe("Modal", () => {
  it("closes on Escape", () => {
    const onClose = vi.fn();
    render(<Modal open onClose={onClose} title="T"><p>x</p></Modal>);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });
  it("is hidden (not display:none) when closed", () => {
    render(<Modal open={false} onClose={() => {}} title="T"><p>x</p></Modal>);
    expect(screen.getByRole("dialog", { hidden: true }).hasAttribute("hidden")).toBe(true);
  });
});
```

```tsx
// app/_ui/json-view.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { JsonView } from "./index";

describe("JsonView", () => {
  it("renders key spans for valid JSON", () => {
    const { container } = render(<JsonView value={'{"a":1}'} />);
    expect(container.querySelector(".j-key")).not.toBeNull();
  });
  it("renders raw text with a marker for invalid JSON", () => {
    render(<JsonView value={"{not json"} />);
    expect(screen.getByText("{not json").closest("[data-invalid]")).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run** `npx vitest run app/_ui/` — FAIL.
- [ ] **Step 3: Implement** all ten. `ToastProvider` renders a fixed-position stack; `useToast` pushes a message auto-dismissed after 2500ms.
- [ ] **Step 4: Run** `npx vitest run app/_ui/` — PASS.
- [ ] **Step 5: Commit**

```bash
git add app/_ui
git commit -m "feat(ui): overlay + layout primitives + JsonView

Claude-Session: https://claude.ai/code/session_01MuK2fgcpXNhze3JYKrBSo5"
```

---

### Task 8: AppShell + TopBar + Sidebar + ProjectSwitcher + PageHeader + Breadcrumbs + PreviewBadge

**Files:**
- Create: `app/_shell/AppShell.tsx`, `TopBar.tsx`, `Sidebar.tsx`, `ProjectSwitcher.tsx`, `PageHeader.tsx`, `Breadcrumbs.tsx`, `PreviewBadge.tsx`, `shell.module.css`
- Test: `app/_shell/shell.test.tsx`

**Interfaces:**
- Consumes: `useViewModel`, `useProject`, `next/navigation` (`usePathname`, `useRouter`), `next/link`, `_ui`, `_lib/theme`.
- Produces:
  - `<AppShell>{children}</AppShell>` — CSS grid: TopBar row (54px), then `[Sidebar 224px | main]`; under 960px Sidebar becomes a `<Drawer>` toggled from a TopBar button.
  - `<TopBar/>` — cube-glyph wordmark linking `/projects`; `<ProjectSwitcher/>` when `usePathname()` starts `/p/`; `<Kbd>⌘K</Kbd>` hint; status dot ("Running"); theme toggle button calling `toggleTheme()`.
  - `<Sidebar/>` — WORKSPACE group: Projects `/projects`, Endpoints `/endpoints`, Traffic `/traffic`. PROJECT group only when pathname matches `/p/[slug]`: Overview `/p/<slug>`, Endpoints `/p/<slug>/endpoints`, Cases, Rules, Scenarios, Environments, Variables. Settings pinned bottom `/p/<slug>/settings`. Active link: `aria-current="page"` + accent token style, computed from `usePathname()`.
  - `<ProjectSwitcher/>` — `<Dropdown>` of `useViewModel().projects`; selecting pushes `/p/<slug>` + the current trailing sub-segment when one exists, else `/p/<slug>`.
  - `<PageHeader title: string description?: string actions?: ReactNode/>`
  - `<Breadcrumbs items: {label: string; href?: string}[]/>`
  - `<PreviewBadge/>` — `<Badge tone="warning">Preview</Badge>` wrapped in `<Tooltip label="Local only — not saved to the backend">`.

- [ ] **Step 1: Write the failing test**

```tsx
// app/_shell/shell.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ViewModelProvider } from "@/app/_lib/view-model-context";
import { Sidebar } from "./Sidebar";

vi.mock("next/navigation", () => ({
  usePathname: () => "/p/card-block-lost/endpoints",
  useRouter: () => ({ push: vi.fn() }),
}));

const model = { build: { commit: "x", builtAt: "", warnings: [] },
  projects: [{ slug: "card-block-lost", name: "Card Block", endpoints: [], caseCount: 0 }] };

describe("Sidebar", () => {
  it("shows the PROJECT group inside a project and marks the active route", () => {
    render(<ViewModelProvider model={model as never}><Sidebar /></ViewModelProvider>);
    expect(screen.getByText("Cases")).toBeDefined();
    const active = screen.getByRole("link", { name: "Endpoints", current: "page" });
    expect(active).toBeDefined();
  });
});
```

- [ ] **Step 2: Run** `npx vitest run app/_shell/` — FAIL.
- [ ] **Step 3: Implement** all eight files + CSS module. Wordmark: Inter 800 + inline cube SVG from the approved mock. `CommandPalette`/`GlobalSearch` are stubbed as empty exports for now (filled in Phase 3) so `AppShell` can import them without error — or omit the import until Phase 3. Prefer: omit; add in T3.3.
- [ ] **Step 4: Run** `npx vitest run app/_shell/ && npx tsc --noEmit` — PASS.
- [ ] **Step 5: Commit**

```bash
git add app/_shell
git commit -m "feat(shell): AppShell, TopBar, Sidebar, ProjectSwitcher

Claude-Session: https://claude.ai/code/session_01MuK2fgcpXNhze3JYKrBSo5"
```

---

### Task 9: `(app)` layout + root redirect + project stub

**Files:**
- Create: `app/(app)/layout.tsx`, `app/(app)/p/[slug]/layout.tsx`, `app/(app)/p/[slug]/page.tsx` (stub)
- Modify: `app/page.tsx`
- Test: `app/(app)/layout.test.tsx`

**Interfaces:**
- Consumes: `bundleJson`, `buildViewModel` (same imports `app/page.tsx` uses today), `ViewModelProvider`, `PreviewProvider`, `ToastProvider`, `AppShell`, `useProject`, `notFound`.
- Produces: server `(app)/layout.tsx` building the model once, wrapping children in the three providers + `<AppShell>`. `app/page.tsx` -> `redirect("/projects")`. `p/[slug]/layout.tsx` resolves the project, `notFound()` on miss. `p/[slug]/page.tsx` stub renders `<PageHeader title={project.name}/>`.

- [ ] **Step 1: Write the failing test** — assert `(app)/layout.tsx` source imports `buildViewModel` and renders `ViewModelProvider` + `AppShell`; assert `app/page.tsx` calls `redirect("/projects")`.

```tsx
// app/(app)/layout.test.tsx
import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
const layout = readFileSync(new URL("./layout.tsx", import.meta.url), "utf8");
const page = readFileSync(new URL("../page.tsx", import.meta.url), "utf8");

describe("(app) shell wiring", () => {
  it("builds the ViewModel once in the layout and mounts the providers", () => {
    expect(layout).toMatch(/buildViewModel/);
    expect(layout).toMatch(/ViewModelProvider/);
    expect(layout).toMatch(/PreviewProvider/);
    expect(layout).toMatch(/AppShell/);
  });
  it("root page redirects to /projects", () => {
    expect(page).toMatch(/redirect\("\/projects"\)/);
  });
});
```

- [ ] **Step 2: Run** `npx vitest run "app/(app)/layout.test.tsx"` — FAIL.
- [ ] **Step 3: Implement**

```tsx
// app/(app)/layout.tsx
import type { ReactNode } from "react";
import bundleJson from "@/mocks.generated.json";
import type { CompiledBundle } from "@/src/compile/compile";
import { buildViewModel } from "@/src/viewer/model";
import { ViewModelProvider } from "@/app/_lib/view-model-context";
import { PreviewProvider } from "@/app/_lib/preview-store";
import { ToastProvider } from "@/app/_ui";
import { AppShell } from "@/app/_shell/AppShell";

export default function AppLayout({ children }: { children: ReactNode }) {
  const model = buildViewModel(bundleJson as unknown as CompiledBundle);
  return (
    <ViewModelProvider model={model}>
      <PreviewProvider>
        <ToastProvider>
          <AppShell>{children}</AppShell>
        </ToastProvider>
      </PreviewProvider>
    </ViewModelProvider>
  );
}
```

```tsx
// app/page.tsx
import { redirect } from "next/navigation";
export default function RootPage(): never {
  redirect("/projects");
}
```

```tsx
// app/(app)/p/[slug]/layout.tsx
"use client";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { useProject } from "@/app/_lib/view-model-context";

export default function ProjectLayout({ children, params }: { children: ReactNode; params: { slug: string } }) {
  const project = useProject(params.slug);
  if (!project) notFound();
  return <>{children}</>;
}
```

> Next 15 passes `params` as a Promise to server components but the plain object to client components via the layout prop only in some versions — if `params` is a Promise here, `use(params)` it. Confirm against the installed `next` 15.5 behavior when implementing; adjust to `const { slug } = use(params)` if the test/build complains.

```tsx
// app/(app)/p/[slug]/page.tsx  (stub — replaced in Phase 2 T2.2)
"use client";
import { useProject } from "@/app/_lib/view-model-context";
import { PageHeader } from "@/app/_shell/PageHeader";

export default function ProjectOverview({ params }: { params: { slug: string } }) {
  const project = useProject(params.slug)!;
  return <PageHeader title={project.name} />;
}
```

- [ ] **Step 4: Run** `npm run check` then `npm run build` — Expected: both green; route tree lists `/`, `/projects` (404 until Task 10), `/p/[slug]`.
- [ ] **Step 5: Commit**

```bash
git add "app/(app)" app/page.tsx
git commit -m "feat(app): (app) route group + redirect root to /projects

Claude-Session: https://claude.ai/code/session_01MuK2fgcpXNhze3JYKrBSo5"
```

---

### Task 10: Projects page (PAGE 01)

**Files:**
- Create: `app/(app)/projects/page.tsx`, `app/_features/projects/ProjectGrid.tsx`, `ProjectCard.tsx`, `ProjectListRow.tsx`, `ProjectEmptyState.tsx`, `projects.module.css`
- Test: `app/_features/projects/projects.test.tsx`

**Interfaces:**
- Consumes: `useViewModel`, `_ui`, `_lib/use-debounced`, `next/link`.
- Produces:
  - `<ProjectGrid projects: ProjectVM[] view: "grid" | "list"/>`
  - `<ProjectCard project: ProjectVM/>` — cube glyph, name, `mockservers.dailyuze.com/m/<slug>`, `<b>{endpoints.length}</b> endpoints` / `<b>{caseCount}</b> cases`, "Running" status dot, `<CopyButton text={`https://mockservers.dailyuze.com/m/${slug}`}/>`, `Open` link -> `/p/<slug>`.
  - `<ProjectEmptyState/>` — `<EmptyState>` "Your API workspace is empty" + disabled "Create project" + tooltip.
  - Page: `<PageHeader title="Your mock APIs" description="Create, organize and run isolated mock APIs for development and testing." actions={<Button variant="primary" disabled>New Project</Button>}/>` (button gets a `<Tooltip label="Preview — coming soon">` wrapper; wired to `CreateProjectModal` in Phase 5 T5.8), debounced search input, grid/list segmented control, sort `<Select>` (name | case count | endpoint count).

- [ ] **Step 1: Write the failing test**

```tsx
// app/_features/projects/projects.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ViewModelProvider } from "@/app/_lib/view-model-context";
import ProjectsPage from "@/app/(app)/projects/page";

vi.mock("next/navigation", () => ({ usePathname: () => "/projects", useRouter: () => ({ push: vi.fn() }) }));

const model = { build: { commit: "abc123", builtAt: "", warnings: [] }, projects: [
  { slug: "card-block-lost", name: "Card Block (Lost Card)", endpoints: [{}, {}, {}], caseCount: 35 },
] } as never;

describe("Projects page", () => {
  it("renders a card per project with endpoint and case counts", () => {
    render(<ViewModelProvider model={model}><ProjectsPage /></ViewModelProvider>);
    expect(screen.getByText("Card Block (Lost Card)")).toBeDefined();
    expect(screen.getByText("3")).toBeDefined();
    expect(screen.getByText("35")).toBeDefined();
    expect(screen.getByRole("link", { name: /card-block-lost/i })).toBeDefined();
  });
  it("shows the empty state with no projects", () => {
    render(<ViewModelProvider model={{ ...(model as object), projects: [] } as never}><ProjectsPage /></ViewModelProvider>);
    expect(screen.getByText(/workspace is empty/i)).toBeDefined();
  });
});
```

- [ ] **Step 2: Run** `npx vitest run app/_features/projects/` — FAIL.
- [ ] **Step 3: Implement** page + four components + CSS. Search filters by name/slug (debounced 150ms). Sort + grid/list toggle held in `useState`.
- [ ] **Step 4: Run** `npm run check` — PASS.
- [ ] **Step 5: Commit**

```bash
git add "app/(app)/projects" app/_features/projects
git commit -m "feat(projects): Projects dashboard page

Claude-Session: https://claude.ai/code/session_01MuK2fgcpXNhze3JYKrBSo5"
```

---

### Task 11: Phase 1 parity cutover — delete `app/_explorer/`

**Files:**
- Delete: `app/_explorer/` (entire directory)

- [ ] **Step 1** `grep -rn "_explorer" app/ src/` — expect hits only inside `app/_explorer/` itself. `app/page.tsx` no longer imports `ExplorerApp` (done in Task 9).
- [ ] **Step 2** `git rm -r app/_explorer`
- [ ] **Step 3: Run** `npm run check` — PASS. Then `npm run build` — Expected: route tree builds; `/` and `/projects` present.
- [ ] **Step 4: Manual** `npm run dev`: `/` redirects to `/projects`; cards render real projects; search / sort / view work; theme toggle flips Obsidian/Paper; sidebar + TopBar present; `/p/card-block-lost` renders the stub header (not a crash).
- [ ] **Step 5: Commit**

```bash
git rm -r app/_explorer
git commit -m "refactor(app): remove legacy _explorer UI; /projects is the entry point

Claude-Session: https://claude.ai/code/session_01MuK2fgcpXNhze3JYKrBSo5"
```

---

### Phase 1 exit criteria

- `npm run check` green; `npm run build` green.
- `/` -> `/projects`; grid renders real projects; search / sort / view work.
- Obsidian theme default + Paper toggle; `prefers-reduced-motion` respected.
- Sidebar + TopBar + ProjectSwitcher present; `:focus-visible` visible.
- No `app/_explorer/` references remain; all pre-existing `src/**` tests pass untouched.

---

# PHASE 2 — Project pages + Endpoint Workspace + Runner (task inventory)

Each task expands to bite-sized TDD steps (test -> fail -> impl -> pass -> commit) in a Phase 2 planning pass before execution.

- **T2.1 `p/[slug]/layout.tsx` enrichment** — `<Breadcrumbs>` + project sub-nav context (the file exists as a stub from Task 9). Test: unknown slug -> `notFound()`.
- **T2.2 Project Overview `p/[slug]/page.tsx` (PAGE 02)** — replace the stub: `<PageHeader>` name/description, status dot, mono base URL + `<CopyButton>`; `ProjectStats` strip (Endpoints, Cases from `ProjectVM`; Requests / Success rendered `—` + `<PreviewBadge>`); "Recent traffic" mini-list from `sample-traffic.ts` under a `<PreviewBadge>`. Test: counts render; preview markers present.
- **T2.3 `EndpointList` + `EndpointRow` + `EndpointToolbar`** — salvage keyboard nav from `_explorer/EndpointList.tsx`; `<MethodPill>`; search + method filter + all/grouped segmented; case-count column. Test: filter narrows; arrow keys move selection.
- **T2.4 Endpoints index `p/[slug]/endpoints/page.tsx` (PAGE 03)** — list view; row click -> `?e=<key>`; `+ New Endpoint` disabled + tooltip. Test: row click sets the query param (`useRouter` mock).
- **T2.5 `CaseList` + `CaseRow` + `CaseDetail`** — salvage from `_explorer/CaseList.tsx`; status dot via `statusKind`, mono name, description from `match` summary, `<StatusCode>`, overflow `<Dropdown>` (items disabled/preview). Test: one row per case; keyboard selection.
- **T2.6 `BodyEditor`** — textarea + line-number gutter; `Format` = `JSON.stringify(JSON.parse(x), null, 2)`, on throw keep text + inline `data-invalid` marker (does not block Execute); `Copy`, `Reset`. Test: valid pretties; invalid preserved + marker.
- **T2.7 `HeadersEditor`** — textarea parsed by `parseHeaderLines`. Test: `a: b\nc: d` -> `{a:"b",c:"d"}`.
- **T2.8 `RequestBuilder` + `RequestTabs`** — lift `execute()` from `_explorer/Runner.tsx` **verbatim** (same `fetch`, `noBody` rule, `performance.now` timing, `classifyResult`). Tabs: Body + Headers real; Params / Auth / Pre-request preview (empty-with-note). Method/URL row. `Execute` + `⌘↵` when focus within. Test: the moved `_explorer` runner-test assertions pass unchanged against the new component.
- **T2.9 `ResponseViewer` + `VerdictLine`** — status / duration / `new Blob([bodyText]).size`; Body/Headers/Raw tabs; Pretty/Raw toggle; `<VerdictLine>` from `verdictText`. Test: size calc; status class; verdict text mapping (move `_explorer/trace.test.ts` verdict cases here).
- **T2.10 `CodeGenerator`** — tabs cURL (real: `renderCurl`) / Java / Python / JavaScript / Go (preview "coming soon" panel). `⌘⇧C` copies cURL. Test: cURL tab output equals `renderCurl(draft.curl)`; other tabs show the preview note.
- **T2.11 `EndpointWorkspace` (PAGE 04, hero)** — 3-col grid 232 / 288 / 1fr = `EndpointList` / `CaseList` / (`RequestBuilder` + `ResponseViewer` + `CodeGenerator`); selection from `?e=` / `?c=` query params (deep-linkable); under 960px columns become `<Tabs>`. Test: `?e=GET_CARD&c=locate-card-happy` selects both; changing selection updates the URL.
- **T2.12 wire workspace into `p/[slug]/endpoints/page.tsx`** — `?e=` present -> `<EndpointWorkspace>`, else the list. Test: query param toggles the view.
- **T2.13 Cases page `p/[slug]/cases/page.tsx` (PAGE 05)** — grouped `CaseList` across all endpoints; `+ Add case` disabled + tooltip. Test: renders every case.
- **Phase 2 exit:** runner executes against live `card-block-lost` for every endpoint; cURL copy byte-identical to today; deep links resolve; `npm run check` + `npm run build` green.

---

# PHASE 3 — Command palette, global search, shortcuts, polish (task inventory)

- **T3.1 `_lib/search.ts` `searchViewModel(model, query)`** -> `{ projects: ProjectVM[]; endpoints: { project: ProjectVM; endpoint: EndpointVM }[]; cases: { project: ProjectVM; endpoint: EndpointVM; case: CaseVM }[] }`, case-insensitive substring on name / path / id, capped 8 per group, `[]` for empty query. Test: fixture model -> expected groups.
- **T3.2 `GlobalSearch`** — input + grouped results; `Enter` navigates (project -> `/p/<slug>`, endpoint -> `/p/<slug>/endpoints?e=<key>`, case -> `+&c=<id>`). Test: query renders groups; selection pushes the right route.
- **T3.3 `CommandPalette`** — `role="dialog"`, focus trap, global `⌘K` / `Ctrl K` listener in `AppShell`, `Esc` closes. Contextual commands — always: Toggle theme, Open Projects / Endpoints / Traffic, Switch project. In a project: Copy mock URL (real), Copy cURL (real, when a case is active), Run selected case (real), New endpoint / case (preview, tagged). Inline search results from T3.1. Test: filter matches a command; real command fires its handler; preview command shows the tag; `⌘K` opens.
- **T3.4 `_lib/shortcuts.ts`** — `⌘K`, `⌘P` (switcher), `⌘E` (new endpoint -> preview toast), `⌘Enter` (execute), `⌘S` (save case -> preview toast), `⌘⇧C` (copy cURL), `Esc` (close overlay). Suppressed while typing in an input except body editor + `⌘Enter`. Ctrl equivalents on non-Mac. Test: synthetic keydown fires the mapped action; typing in `<input>` suppresses non-exempt shortcuts.
- **T3.5 polish** — `Skeleton` on route transitions; `Toast` on copy / preview actions; `EmptyState` variants; error boundary in `(app)/layout.tsx`. Test: error boundary renders a fallback on a thrown child.
- **Phase 3 exit:** `⌘K` everywhere; search finds projects / endpoints / cases; shortcuts per source spec §25; `npm run check` green.

---

# PHASE 4 — Traffic, Environments, Variables — all PREVIEW (task inventory)

- **T4.1 `sample-traffic.ts`** — deterministic ~40 `TrafficEntry { id: string; method: string; endpointKey: string; path: string; status: number; at: string; ms: number; reqHeaders: Record<string,string>; reqBody: string; resBody: string }` derived from real `card-block-lost` cases. Test: every entry references a real endpoint key.
- **T4.2 `TrafficTable` + `TrafficRow`** — columns Method / Endpoint / Status / Time / Response; `<MethodPill>`, `<StatusCode>`, `tabular-nums`; row click selects. Test: renders rows; selection state.
- **T4.3 `TrafficDrawer`** — right `<Drawer>`, table visible behind; sections Request headers / body, Response; `Replay request` -> navigate `/p/<slug>/endpoints?e=<key>&c=<id>` (hands off to the REAL runner). Test: `Esc` closes; Replay pushes the right route.
- **T4.4 `p/[slug]/traffic/page.tsx` + `(app)/traffic/page.tsx`** — `<PreviewBadge>`, search / filter / export (export = download JSON of the sample data — real action, labeled). Test: page renders with badge.
- **T4.5 `EnvironmentList` + `p/[slug]/environments/page.tsx`** — from `usePreview().state.environments`; select -> `set` `activeEnvId`; `Add environment` modal (real local add). `<PreviewBadge>`. Test: selecting updates the active env in the store.
- **T4.6 `_lib/env-url.ts`** — `applyEnv(url: string, env: Env): string` replaces the origin of a URL with `env.baseUrl` (path + query intact); `stripEnv(url: string): string` sets origin back to `window.location.origin`. Pure. Test: `applyEnv` then `stripEnv` round-trips; query preserved.
- **T4.7 wire `activeEnv` into `RequestBuilder`** — the pre-filled URL and the cURL string use `applyEnv`; the actual `fetch` still uses the field value. Test: changing active env rewrites the displayed URL only, not the fetch target.
- **T4.8 `VariableTable` + `p/[slug]/variables/page.tsx`** — from `usePreview().state.variables`; add row; reveal toggle for masked values; scope `<Badge>`. `<PreviewBadge>`. Test: add persists to store; reveal toggles masking.
- **Phase 4 exit:** all four pages functional as PREVIEW; state survives reload within the tab; nothing new hits the network; `npm run check` green.

---

# PHASE 5 — Rules, Scenarios, Public, Settings (task inventory)

- **T5.1 `RuleList` + `RuleCard` (READ, REAL)** — per endpoint, render `CaseVM.match` as IF chips (`field op value`) + THEN (`return case <id>` / `status <code>`), in route order. `field` derivation: `jsonPath` `$.x` -> `body.x`; `header` -> `header.X`; `query` -> `query.X`. Test: a `card.yaml`-derived fixture renders the expected chips in order.
- **T5.2 `RuleBuilder` + `ConditionRow` (PREVIEW)** — visual editor writing `usePreview().state.rulesDraft[endpointKey]`; `Export YAML` -> `routes/*.yaml` block string + `<CopyButton>`. `<PreviewBadge>`; never claims the rule is live. Test: adding a condition updates the store; export produces expected YAML for a known input.
- **T5.3 `p/[slug]/rules/page.tsx`** — READ list on top, PREVIEW builder below a divider. Test: both sections present.
- **T5.4 `ScenarioCanvas` + `ScenarioNode` + `ScenarioConnector` + `ScenarioToolbar` (PREVIEW)** — dotted dark canvas, vertical node stack, thin connectors, add / remove / edit step (step = endpoint + expected status), `Run scenario` disabled + tooltip. State in `usePreview().state.scenarios[slug]`. Test: add step -> node appears + persists; run button disabled.
- **T5.5 `p/[slug]/scenarios/page.tsx`** — `<PreviewBadge>`, seeded "Card Blocking" scenario (GET_CARD -> CHECK_CARD_ELIGIBILITY -> BLOCK_CARD -> NOTIFY_CUSTOMER). Test: seed renders 4 nodes.
- **T5.6 `PublicServerPanel` + `p/[slug]/public/page.tsx` (REAL)** — base URL + `<CopyButton>`; `/m/<slug>/__spec` link shown only when the project has OpenAPI. Thread a `Set<string>` of slugs-with-spec from `(app)/layout.tsx` (reading `bundleJson.projects[slug].openApiDoc != null` there) through a small context — **do not edit `src/viewer/model.ts`**. QR = hand-rolled SVG/CSS of the base URL, or a bordered placeholder labelled "QR" if a real QR is too heavy (YAGNI — placeholder is acceptable). Test: copy button carries the base URL; spec link hidden when no OpenAPI.
- **T5.7 `SettingsTabs` + `p/[slug]/settings/page.tsx` (READ REAL / edit PREVIEW)** — tabs General / Access / Server / Import-Export / Danger Zone via `?tab=`. General + Server pre-filled from real config (name, description, `basePath`, slug disabled, `defaults.cors`, `defaults.delayMs`) — read the same `bundleJson.projects[slug]` via the layout context. "Save" -> `project.yaml` diff string + `<CopyButton>` + `<PreviewBadge>`. Danger Zone "Delete project" -> confirm modal that only explains the repo-file deletion (no action). Import/Export: JSON export real (download a `mocks.generated.json` slice), OpenAPI note real, Postman disabled. Test: real values render; Save produces YAML text; Delete opens the explain modal.
- **T5.8 `CreateProjectModal` / `CreateCaseModal` / new-endpoint (PREVIEW)** — each emits a copy-paste YAML stub; wire the buttons disabled in Task 10 / T2.4 / T2.13 to open them. Test: filling the form updates the generated YAML preview.
- **Phase 5 exit:** every nav item leads to a complete page; rules read REAL; all create / edit paths emit YAML; `npm run check` green.

---

# PHASE 6 — Paper theme, responsive, a11y, perf (task inventory)

- **T6.1 Paper theme pass** — audit every `*.module.css` for contrast under `[data-theme="paper"]`; fix weak tokens; verify status colors on light ground. Test: manual + computed-style snapshot of key components in both themes.
- **T6.2 Responsive** — sidebar -> `<Drawer>` under 960px with a TopBar hamburger; workspace 3 columns -> `<Tabs>` under 960px; tables -> stacked rows under 720px. Test: render at widths via `matchMedia` mock; assert the collapsed structure.
- **T6.3 a11y sweep** — every icon-only button has `aria-label`; logical `Tab` order; `Esc` closes every overlay; `:focus-visible` on all interactives; palette / drawer / modal are labelled dialogs with focus trap. Assert key ARIA attributes in tests (no new a11y dep — honor "no new deps"). `npm run lint` clean with `eslint-config-next`'s jsx-a11y rules.
- **T6.4 perf** — `useDebounced` on every search input (150ms); memoize `searchViewModel`; virtualize a list only if it exceeds ~200 rows (card-block-lost has 7 endpoints / 35 cases -> none needed; document the decision, add no windowing lib). Test: search input does not re-filter on every keystroke (fake timers).
- **T6.5 final QA against source spec §37** — walk the checklist; fix regressions.
- **Phase 6 exit:** source spec §37 quality bar met; both themes ship; responsive per §28; `npm run check` + `npm run build` green.

---

## Wrap-up

- [ ] `npm run check` green on the final commit.
- [ ] `npm run build` green.
- [ ] Manual QA checklist (source spec §37) walked and signed off.
- [ ] One PR: `feat/obsidian-redesign` -> `main`; body links this plan, the design doc, and the approved mocks artifact; body ends with `https://claude.ai/code/session_01MuK2fgcpXNhze3JYKrBSo5`.

## Self-review notes

- **Spec coverage:** source spec §1–37 — tokens/theme §1/§31 (T1), fonts §1 (T2), shell/branding §3/§4/§5/§6 (T8), Projects §7 (T10), Overview §8 (T2.2), Endpoints §9 (T2.3–4), Workspace §10 (T2.11), Cases §11–12 (T2.5, T5.8), Runner §13 (T2.6–8, T2.10), Response §14 (T2.9), Rules §15 (T5.1–3), Scenarios §16 (T5.4–5), Traffic §17–18 (T4.1–4), Environments §19 (T4.5–7), Variables §20 (T4.8), Public §21 (T5.6), Settings §22 (T5.7), Project creation §23 (T5.8), Command palette §24 (T3.3), Shortcuts §25 (T3.4), Global search §26 (T3.1–2), Micro-interactions §27 (T3.5, T6.1), Responsive §28 (T6.2), a11y §29 (T6.3), Components §30 (T6–8 + feature tasks), Existing-functionality §32 / State §33 (Global Constraints + preview-store T4), Performance §34 (T6.4), Priority §36 (phase order), Quality bar §37 (T6.5). No gaps.
- **Placeholder scan:** Phase 1 tasks carry full code and exact commands. Phases 2–6 are explicit task inventories, expanded per-phase before execution — the decomposition the writing-plans scope check calls for (six independently shippable subsystems), not hidden placeholders.
- **Type consistency:** `PreviewState` / `Env` / `Variable` / `Scenario` / `ScenarioStep` / `DraftRule` defined once (Task 4). `searchViewModel` return shape defined once (T3.1). `applyEnv` / `stripEnv` signatures fixed in T4.6, consumed in T4.7. `ViewModel` / `ProjectVM` / `EndpointVM` / `CaseVM` / `MatchCondition` imported unchanged from the frozen `src/viewer/model.ts` and `src/engine/types.ts`.
