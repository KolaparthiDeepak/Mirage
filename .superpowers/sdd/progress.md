# mockservers Obsidian Redesign — SDD progress

Plan: docs/plans/2026-08-30-mockservers-obsidian-redesign.md
Design doc: docs/specs/2026-08-30-mockservers-obsidian-redesign-design.md
Branch: feat/obsidian-redesign (off main)
Base before Task 0: bfe7cfcffc7c2d13c327317d8424b11c0b9d62ea

(Prior plan "mockservers v1" — all 12 tasks complete, merged to main. Superseded here.)

## Environment note for implementers
- Local default Node is v18 (below the >=20 floor). Use Node 22: `nvm use 22` before any npm/npx command.
- Commit identity: repo-local personal (Deepak Kolaparthi <KolaparthiDeepak@users.noreply.github.com>). No commits to main.
- Every commit message ends with: Claude-Session: https://claude.ai/code/session_01MuK2fgcpXNhze3JYKrBSo5
- Backend frozen: src/engine, src/compile, src/openapi, src/viewer/{model,curl,verdict}.ts, app/m/[...slug], app/%5F%5Fmock, mocks/**, mocks.generated.json, scripts/*, next.config.mjs, vercel.json.

## Executing: PHASE 1 (Tasks 0–11)

## Ledger
Task 0: complete (commit 7d4b55e, base 729aefe). Per-file jsdom via environmentMatchGlobs [["app/**/*.test.tsx","jsdom"]] — global flip broke 9 swagger-parser tests (AbortSignal). 122 tests green. Controller-verified (trivial mechanical diff, no reviewer subagent). CONVENTION: component render tests must be *.test.tsx.

## Minor findings (for final whole-branch review to triage)
- T0: new devDeps use `^` ranges while the rest of package.json pins exact versions. Consider pinning @testing-library/{react,dom} + jsdom exact.
- T0: app/_lib/smoke.test.tsx has an unused `import React` (harmless with the automatic JSX runtime).
