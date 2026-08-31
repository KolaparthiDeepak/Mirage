# MOCKSERVERS — Luxury UI/UX Implementation Specification

## Objective

Redesign the existing MOCKSERVERS web application into a premium developer-infrastructure product.

The application is a personal mock API platform where the user can create/manage an unlimited number of projects, define many mock endpoints and cases, and hit those endpoints through the mock server API.

IMPORTANT:
- Preserve all existing backend/API behavior.
- Do not break existing routes, projects, endpoints, cases, request execution, cURL generation, or mock-server functionality.
- This task is primarily a UI/UX redesign and information-architecture upgrade.
- Reuse existing functionality wherever possible.
- Do not create fake functionality that implies backend support unless the current backend already supports it. For future capabilities, build the UI in a way that can be wired later.
- The current application/screenshots are the visual/functionality reference.
- Desktop-first, responsive second.
- The final product should feel like a serious developer tool, not a generic SaaS admin dashboard.

## Product positioning

Think:

**Linear × Vercel × Raycast × Postman**

The visual personality should be:
- premium
- minimal
- technical
- calm
- highly usable
- information-dense without feeling crowded
- keyboard-friendly
- developer-focused

Avoid:
- generic AI SaaS aesthetics
- excessive gradients
- excessive glassmorphism
- giant rounded cards
- oversized dashboard charts
- rainbow-colored UI
- decorative illustrations
- excessive shadows
- unnecessary animations

---

# 1. PRIMARY VISUAL THEME — OBSIDIAN MIDNIGHT

Make this the primary/default theme.

### Colors

- Background: `#0B0C0F`
- Surface: `#111318`
- Elevated surface: `#17191F`
- Border: `#252831`
- Primary text: `#F5F5F2`
- Secondary text: `#8B909B`
- Muted text: `#626773`
- Accent: `#A78BFA`
- Accent hover: `#B59AFB`
- Success: `#46C88A`
- Warning: `#E8B85C`
- Error: `#EF6B73`
- Info: `#6EA8FE`

Use accent colors sparingly. Status colors should be used for indicators, not large filled sections.

### Typography

- Inter for UI
- JetBrains Mono for API paths, HTTP methods, JSON, status codes, URLs and technical data

Hierarchy:
- Page title: 24–30px
- Section title: 14–18px
- Body: 13–14px
- Metadata: 11–12px
- Technical data: 12–13px monospace

### Shape

- Border radius: 6–10px
- Buttons: 6–8px
- Inputs: 6–8px
- Avoid excessive pill-shaped UI except status badges/tags.

### Borders

Use subtle 1px borders. Do not rely heavily on shadows.

### Animation

Use 150–200ms transitions for hover, selection, drawers, dropdowns, modal opening and tabs. No excessive motion.

---

# 2. OPTIONAL THEMES

Build the design system so additional themes can be selected later.

### Paper
Warm off-white background, dark text, beige borders, subtle violet accent.

### Obsidian
Default premium dark theme described above.

### Aurora
Deep navy/purple developer-focused theme with restrained violet/blue accent.

Do not duplicate component implementations for each theme. Centralize theme tokens.

---

# 3. GLOBAL APPLICATION SHELL

Replace the current large empty layout with a professional application shell.

Desktop structure:

```text
┌───────────────────────────────────────────────────────────────┐
│ BRAND / PROJECT CONTEXT                 SEARCH   STATUS   MENU │
├───────────────┬───────────────────────────────────────────────┤
│ SIDEBAR       │ MAIN CONTENT                                  │
└───────────────┴───────────────────────────────────────────────┘
```

Sidebar: approximately 220–240px.
Top bar: approximately 52–60px.

Keep the sidebar visually light.

---

# 4. BRANDING

Brand:

**MOCKSERVERS**

Use a minimal geometric server/cube/M-inspired icon. Do not use a generic cloud icon.

---

# 5. TOP BAR

On Projects page:

```text
◈ MOCKSERVERS

Your projects                         ⌘ K    + New Project    ◐
```

Inside a project:

```text
◈ MOCKSERVERS

Card Service ▾                       ⌘ K    ● Running    ⋯
```

The project selector should allow switching projects.

Show server status as a small indicator, not a huge badge.

---

# 6. SIDEBAR

Use:

```text
WORKSPACE

⌂ Projects
⇄ Endpoints
⌁ Traffic

PROJECT

◉ Card Service
  Overview
  Endpoints
  Cases
  Scenarios
  Environments
  Variables

────────────────────

⚙ Settings
```

Rules:
- Compact navigation.
- Selected item gets subtle accent background/border.
- Simple consistent icons.
- Project-specific navigation appears only inside a project.
- Collapse gracefully on smaller screens.

---

# 7. PAGE 01 — PROJECTS / DASHBOARD

Replace the current large empty projects screen.

Header:

```text
Your mock APIs

Create, organize and run isolated mock APIs for development and testing.

[ + New Project ]
```

Project cards in a responsive grid.

Example:

```text
┌─────────────────────────────────────┐
│ ◈  Card Service                     │
│                                     │
│ Mock server                         │
│ https://mockservers.dailyuze.com/   │
│                                     │
│ 5 endpoints       35 cases          │
│                                     │
│ ● Running                           │
│                                     │
│ Updated 5 min ago              →    │
└─────────────────────────────────────┘
```

Hover actions:
- Open
- Copy base URL
- Duplicate
- Export
- Settings
- More

Support:
- Search projects
- Sort
- Grid/list view if practical
- New project

Empty state:

```text
◇

Your API workspace is empty

Create your first mock server and start simulating APIs.

[ + Create project ]

or import an API specification
```

---

# 8. PAGE 02 — PROJECT OVERVIEW

Example:

```text
Card Service

Mock API for card management and blocking workflows.

● RUNNING
https://mockservers.dailyuze.com/m/card-block-lost
```

Summary:

```text
5          35          12.4k        99.8%
Endpoints  Cases       Requests     Success
```

Recent traffic:

```text
Recent traffic

GET   /card/1234          200    18ms
POST  /card/1234/block   200    42ms
GET   /card/9999          404    12ms
```

Keep this small and useful. Do not create a giant analytics dashboard.

---

# 9. PAGE 03 — ENDPOINTS

This is one of the most important pages.

```text
Card Service                              ● RUNNING

Search endpoints...                 [ + New Endpoint ]

ALL ENDPOINTS    GROUPED

GET       /cards                    200
GET       /cards/{id}               200
POST      /cards                    201
PUT       /cards/{id}               200
DELETE    /cards/{id}               204
POST      /cards/{id}/block        200
POST      /cards/{id}/unblock      200
```

HTTP methods should have tiny restrained method labels.

Support:
- search
- method filter
- path filter
- grouped view
- sorting
- create endpoint
- endpoint actions

Do not use giant colored HTTP method blocks.

---

# 10. PAGE 04 — ENDPOINT WORKSPACE

This should be the hero screen.

Use a three-column workspace:

```text
┌────────────────┬────────────────────┬──────────────────────────┐
│ ENDPOINTS      │ CASES              │ REQUEST                  │
│                │                    │                          │
│ GET /card      │ ✓ Card found       │ POST                     │
│                │   200              │ /commands/.../GET_CARD   │
│ CHECK_CARD     │                    │                          │
│ _ELIGIBILITY   │ ○ Card not found   │ Headers                  │
│                │   404              │                          │
│ BLOCK_CARD     │ ○ Service down     │ Body                     │
│                │   500              │                          │
│ NOTIFY         │ ○ Already blocked  │                          │
│ _CUSTOMER      │   200              │ [ Execute  ⌘↵ ]          │
│                │                    │                          │
│ VERIFY         │ + Add case         │                          │
│ _CUSTOMER      │                    │                          │
└────────────────┴────────────────────┴──────────────────────────┘
```

Approximate widths:
- Endpoints: 240px
- Cases: 280px
- Request: remaining width

The workspace should feel like an IDE/developer tool.

---

# 11. CASES

Cases are a first-class feature.

Example:

```text
CASES                                      + ADD CASE

┌──────────────────────────────────────────────────┐
│ ●  locate-card-not-found                    404 ⋮ │
│    Card doesn't exist                           │
└──────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────┐
│ ●  locate-card-service-down                 500 ⋮ │
│    Simulate downstream service failure           │
└──────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────┐
│ ●  locate-card-already-blocked              200 ⋮ │
│    Card is already blocked                       │
└──────────────────────────────────────────────────┘
```

Use subtle status dot, name, description, status and overflow menu.

---

# 12. CASE CREATION MODAL

```text
Create response case

Name
[ card-not-found ]

Status
[ 404  Not Found ]

Response

{
  "error": "CARD_NOT_FOUND"
}

Latency
[ 0ms ]

[ Cancel ]    [ Create case ]
```

Expose only fields currently supported; keep architecture extensible.

---

# 13. REQUEST RUNNER

Improve the current runner.

Top:

```text
POST    /commands/acropolis-card-mgmt/GET_CARD/v1

[ Execute  ⌘↵ ]
```

Tabs:

```text
Params   Headers   Auth   Body   Pre-request
```

Body editor:
- syntax highlighting
- JSON validation
- formatting
- copy
- reset
- line numbers if practical

Keep existing execution behavior intact.

---

# 14. RESPONSE VIEW

```text
200 OK          42ms          1.2 KB

Body    Headers    Cookies    Raw

{
  "status": "SUCCESS",
  "message": "Card blocked successfully",
  "cardId": "1234",
  "blockedAt": "2026-08-29T15:32:04Z"
}
```

Include status, duration, response size, copy, pretty/raw toggle.

Code-generation tabs:

```text
cURL   Java   Python   JavaScript   Go
```

Keep existing cURL generation compatible.

---

# 15. PAGE 05 — RULES

Build a UI for conditional response selection.

```text
RULES                                      + ADD RULE

┌─────────────────────────────────────────────────────┐
│                                                     │
│ IF                                                  │
│                                                     │
│ body.cardLast4    equals    "0001"                  │
│                                                     │
│ THEN                                                │
│                                                     │
│ return case       locate-card-not-found             │
│ status            404                               │
│                                                     │
│ ● Enabled                                      ⋮   │
└─────────────────────────────────────────────────────┘
```

Potential future rules:

```text
IF header.Authorization exists
THEN authenticated

IF query.status = "failed"
THEN payment-failed

IF body.amount > 100000
THEN high-value-payment
```

If backend does not support rules yet, build a visually complete, isolated UI architecture that can be wired later. Do not imply rules execute if they do not.

---

# 16. PAGE 06 — SCENARIO BUILDER

Create a premium visual workflow builder.

```text
CARD BLOCKING

        ┌─────────────────┐
        │ 1  GET_CARD     │
        │    200          │
        └────────┬────────┘
                 │
                 ▼
        ┌─────────────────┐
        │ 2  ELIGIBILITY  │
        │    200          │
        └────────┬────────┘
                 │
                 ▼
        ┌─────────────────┐
        │ 3  BLOCK_CARD   │
        │    200          │
        └────────┬────────┘
                 │
                 ▼
        ┌─────────────────┐
        │ 4  NOTIFY       │
        │    200          │
        └─────────────────┘
```

Visual style:
- dark canvas
- thin connectors
- subtle active node
- compact nodes
- pan/zoom if practical
- add step
- remove step
- edit step
- run scenario

If backend does not support scenarios, make it future-ready UI only.

---

# 17. PAGE 07 — TRAFFIC

```text
Traffic                                      12,842 requests

Search traffic...                 Filter     Export
```

Table:

```text
METHOD   ENDPOINT                STATUS   TIME       RESPONSE

GET      /card/1234              200      10:42:31   18ms
POST     /card/1234/block        200      10:42:28   42ms
GET      /card/9999              404      10:42:17   12ms
POST     /card/0001/block        500      10:41:59   31ms
```

Clicking a request opens a right-side detail drawer instead of navigating away.

---

# 18. TRAFFIC DETAIL DRAWER

```text
REQUEST                                      ×

POST
/card/1234/block

200 OK       42ms

REQUEST

Headers
{ ... }

Body
{ ... }

RESPONSE

{ ... }

[ Replay request ]
```

Keep the traffic list visible behind the drawer.

---

# 19. PAGE 08 — ENVIRONMENTS

```text
ENVIRONMENTS                             + ADD ENVIRONMENT

● Local
  http://localhost:8080

● Development
  https://dev.mockservers...

● QA
  https://qa.mockservers...

● Production
  https://api.mockservers...
```

Allow environment selection.

If backend does not support environments yet, create isolated UI/state architecture only.

---

# 20. PAGE 09 — VARIABLES

```text
VARIABLES                                + ADD VARIABLE

VARIABLE          VALUE                         SCOPE

API_KEY           ••••••••••                    QA
BASE_URL          https://qa.mockservers...     QA
CARD_PREFIX       1234                          Project
DEFAULT_LIMIT     10                            Global
```

Use reveal controls for secrets.

---

# 21. PAGE 10 — PUBLIC MOCK SERVER

```text
PUBLIC MOCK SERVER

Card Service

Base URL

https://mockservers.dailyuze.com/m/card-block-lost

[ Copy URL ]

Documentation

https://mockservers.dailyuze.com/...

[ Open docs ]

[ QR CODE ]

Share
```

Only show features actually supported.

---

# 22. PAGE 11 — PROJECT SETTINGS

Tabs:

```text
General     Access     Server     Import/Export     Danger Zone
```

General:
- project name
- description
- base path

Server:
- server status
- base URL
- configuration

Import/Export:
- JSON
- OpenAPI if supported
- Postman if supported
- cURL where appropriate

Danger Zone:
- delete project

Do not make settings look like a generic admin panel.

---

# 23. PROJECT CREATION

Premium modal/page:

```text
Create a mock server

Let's build something.

Project name
[ Card Service ]

Choose how to start

┌───────────────────┐  ┌───────────────────┐
│ ✦ Blank project   │  │ ◇ OpenAPI         │
│ Start from zero   │  │ Import your spec  │
└───────────────────┘  └───────────────────┘

┌───────────────────┐  ┌───────────────────┐
│ ⇄ Postman         │  │ ◉ Example API     │
│ Import collection │  │ Start with demo   │
└───────────────────┘  └───────────────────┘

[ Create project ]
```

Only enable import options that are actually supported; otherwise show them disabled/future-ready.

---

# 24. COMMAND PALETTE

Mandatory for the luxury feel.

Keyboard:
`⌘ K` / `Ctrl K`

```text
╭──────────────────────────────────────────────╮
│ Search commands...                           │
├──────────────────────────────────────────────┤
│ → Create endpoint                            │
│ → Create case                                │
│ → Run selected case                          │
│ → Open traffic                               │
│ → Copy mock URL                              │
│ → Copy cURL                                  │
│ → Switch project                             │
│ → Toggle theme                               │
│ → Export project                             │
└──────────────────────────────────────────────┘
```

Commands should be contextual.

---

# 25. KEYBOARD SHORTCUTS

Support where practical:

```text
⌘ K          Command palette
⌘ P          Search project
⌘ E          New endpoint
⌘ Enter      Execute request
⌘ S          Save case
⌘ Shift C    Copy cURL
Esc          Close drawer/modal
```

Use Ctrl equivalents on Windows/Linux.

Do not intercept shortcuts while typing in inputs unless appropriate.

---

# 26. GLOBAL SEARCH

Search:
- projects
- endpoints
- cases
- scenarios

Example:

```text
Search MOCKSERVERS...

Projects
  Card Service

Endpoints
  GET /card
  POST /card/{id}/block

Cases
  locate-card-not-found
```

---

# 27. MICRO-INTERACTIONS

Use:
- hover border transition
- selected row transition
- button press feedback
- drawer slide
- subtle modal fade/scale
- copy confirmation
- execute loading indicator
- status transition

Avoid bouncing, excessive glowing, long animations and decorative effects.

---

# 28. RESPONSIVE DESIGN

Desktop-first.

For smaller screens:
- sidebar collapses
- endpoint/case/request columns become tabs/drawers
- tables become stacked rows
- request/response panels stack vertically
- preserve functionality

Do not simply shrink the desktop layout.

---

# 29. ACCESSIBILITY

Implement:
- keyboard navigation
- visible focus states
- semantic buttons
- aria labels where needed
- sufficient contrast
- tooltips for icon-only controls
- Escape to close overlays
- logical tab order

---

# 30. COMPONENT ARCHITECTURE

Build reusable components rather than duplicated page markup.

Recommended components:

### Layout
- AppShell
- TopBar
- Sidebar
- Breadcrumbs
- PageHeader

### Navigation
- ProjectSwitcher
- CommandPalette
- GlobalSearch

### Projects
- ProjectCard
- ProjectGrid
- ProjectEmptyState
- ProjectStats

### Endpoints
- EndpointList
- EndpointRow
- MethodBadge
- EndpointWorkspace

### Cases
- CaseList
- CaseRow
- CaseEditor
- CaseStatus

### Runner
- RequestBuilder
- RequestTabs
- HeadersEditor
- JsonEditor
- ResponseViewer
- CodeGenerator

### Rules
- RuleList
- RuleBuilder
- ConditionRow
- ActionRow

### Traffic
- TrafficTable
- TrafficRow
- TrafficDrawer
- RequestDetails
- ResponseDetails

### Scenarios
- ScenarioCanvas
- ScenarioNode
- ScenarioConnector
- ScenarioToolbar

### Settings
- SettingsLayout
- SettingsTabs
- EnvironmentList
- VariableTable

### UI
- Button
- Input
- Select
- Tabs
- Drawer
- Modal
- Dropdown
- Tooltip
- Toast
- Badge
- EmptyState
- Skeleton

Use existing framework/component conventions. Do not introduce a large UI library unnecessarily.

---

# 31. DESIGN TOKENS

Centralize:
- colors
- spacing
- radius
- typography
- shadows
- transitions
- z-index

Do not hardcode theme colors throughout components.

Conceptual tokens:

```text
--bg
--surface
--surface-elevated
--border
--text
--text-muted
--accent
--success
--warning
--error

--radius-sm
--radius-md

--space-1
--space-2
--space-3
...
```

---

# 32. IMPORTANT — EXISTING FUNCTIONALITY

Before changing implementation:

1. Inspect the current codebase.
2. Identify existing routing.
3. Identify project model.
4. Identify endpoint model.
5. Identify case model.
6. Identify request runner.
7. Identify cURL generation.
8. Identify existing theme/dark-mode implementation.
9. Identify existing API calls.

Then redesign around those APIs.

DO NOT replace working backend logic just to achieve the new UI.

DO NOT rename API contracts unless absolutely necessary.

DO NOT remove existing functionality.

---

# 33. DATA / STATE PRINCIPLE

The UI must be driven by real application state wherever the backend already provides it.

For future UI-only capabilities:
- keep mock/local state isolated
- separate presentation from future API integration
- do not silently persist fake data to the backend
- make future integration straightforward

---

# 34. PERFORMANCE

The application may contain:
- many projects
- hundreds/thousands of endpoints
- many cases
- many traffic records

Design lists to scale.

Use:
- efficient rendering
- pagination/virtualization where appropriate
- debounced search
- lazy loading for heavy views
- avoid unnecessary global state updates

The UI must remain fast.

---

# 35. FINAL UX PRINCIPLE

The product should communicate:

**"Everything I need to create, inspect and run mock APIs is in one workspace."**

Primary mental model:

```text
Projects
   ↓
Endpoints
   ↓
Cases
   ↓
Rules
   ↓
Request
   ↓
Response
   ↓
Traffic
```

Advanced mental model:

```text
Project
 ├── Endpoints
 ├── Cases
 ├── Rules
 ├── Scenarios
 ├── Environments
 ├── Variables
 ├── Traffic
 └── Settings
```

---

# 36. IMPLEMENTATION PRIORITY

### Phase 1
- App shell
- Obsidian theme
- Projects page
- Sidebar
- Top bar
- Project cards

### Phase 2
- Endpoints page
- Three-column endpoint workspace
- Cases
- Request runner
- Response viewer

### Phase 3
- Command palette
- Global search
- keyboard shortcuts
- polished loading/empty/error states
- drawers/modals/toasts

### Phase 4
- Traffic
- traffic detail drawer
- environments
- variables

### Phase 5
- Rules UI
- Scenario Builder UI
- Public Mock Server UI
- Settings

### Phase 6
- Paper/Aurora themes
- responsive refinements
- accessibility pass
- performance pass

---

# 37. QUALITY BAR

Before finishing:

- No broken existing functionality.
- No placeholder lorem ipsum.
- No fake metrics if real metrics are available.
- No unnecessary gradients.
- No oversized cards.
- No excessive rounded corners.
- No inconsistent spacing.
- No inconsistent typography.
- No generic dashboard appearance.
- Every clickable control should either work or be clearly disabled/future-ready.
- Existing project, endpoint, case and request execution flows must continue to work.
- Test the existing Card Block (Lost Card) project thoroughly after the redesign.
- Verify all current endpoints can still be selected and executed.
- Verify current cases still load.
- Verify request body editing still works.
- Verify Execute still works.
- Verify cURL copy still works.
- Verify dark mode remains readable.

The final result should look like a premium developer tool that could be shipped publicly, while retaining the simplicity and speed of the current MOCKSERVERS application.
