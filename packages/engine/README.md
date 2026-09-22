# @mirage/engine

The pure, dependency-free request resolver Mirage's hosted service runs —
packaged so a consumer's test suite (or `mirage dev`, see `packages/cli`) can
run **the exact same resolver** against **the exact same rule files** the
hosted service compiles. No drift between "mocked in CI" and "mocked in
staging".

```ts
import { resolve, parseRequest, type ProjectConfig } from "@mirage/engine";

const req = await parseRequest(request, "/orders");
const result = resolve(req, project); // project: ProjectConfig
```

## Scope

This package exports the resolver only: `resolve`, `parseRequest`,
`stripBasePath`, `buildResponse`, `serveMock`, and their types. It has **zero
runtime dependencies** — `src/engine/*` in the main repo never imports `yaml`
or `zod`, so neither does this.

The **compiler** (turning `project.yaml` + rule files into a `ProjectConfig`)
is deliberately *not* re-exported here: it needs `yaml`, `zod`, and
`@apidevtools/swagger-parser` for OpenAPI expansion, which would make this
package's "zero dependencies" claim false. `packages/cli` depends on the
compiler directly from the main app's `src/compile/compile.ts` instead. A
`@mirage/compiler` package is a plausible future split if a consumer other
than the CLI ever needs compilation without the CLI around it — not built
speculatively here.

## Current status

This package has **no build step**: `src/index.ts` re-exports directly from
the main app's `src/engine/*` via relative paths, so it works today inside
this workspace (the CLI, and this package's own tests, both resolve those
imports at the TypeScript level with no bundling). It is **not yet published**
and could not be `npm install`ed by an external project as-is — publishing
would need a real build (e.g. `tsup`) that inlines `src/engine/*` into this
package's own `dist/`, so the published tarball doesn't depend on files
outside it. That build, and the actual `npm publish`, are explicitly deferred:
publishing is a one-way, externally-visible action nobody has asked for yet.
