export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS";

export interface ParsedRequest {
  method: string;
  path: string;                          // subpath after /m/<slug>, always starts with "/"
  headers: Record<string, string>;       // lowercased keys
  query: Record<string, string>;
  body: unknown;                         // parsed JSON, or undefined if body absent/not JSON
  rawBody: string;
}

export type Segment =
  | { kind: "literal"; value: string }
  | { kind: "param"; name: string }
  | { kind: "wildcard" }                 // single segment "*"
  | { kind: "catchall" };                // trailing "**"

export type Operator =
  | { equals: string } | { notEquals: string } | { contains: string }
  | { regex: string } | { exists: boolean };

export type MatchCondition =
  | ({ jsonPath: string } & Operator)
  | ({ header: string } & Operator)
  | ({ query: string } & Operator);

export interface MockResponse {
  status: number;
  headers?: Record<string, string>;
  body?: unknown;                        // object | string | null
}

/** Plan 10 — stateful variants. `response` above stays the default; when
 *  `responses` is present the state layer (src/state/apply.ts) picks a
 *  variant per (slug, ruleId, session). resolve() never reads this. */
export interface ResponseVariant extends MockResponse {
  weight?: number;
  when?: { callCount: { gte?: number; lt?: number; eq?: number } };
}
export interface ResponseVariants {
  strategy: "sequence" | "weighted" | "conditional";
  variants: ResponseVariant[];
  repeatLast: boolean;
  sessionHeader?: string;
}

/** Plan 12 — an async callback fired after the response. resolve() never
 *  reads this; the mock route schedules delivery. */
export interface CallbackConfig {
  url: string;
  method: "POST" | "PUT" | "PATCH" | "GET" | "DELETE";
  delayMs: number;
  headers?: Record<string, string>;
  body?: unknown;
  retry?: { attempts: number; backoffMs: number };
}

export interface Route {
  id: string;
  method: HttpMethod | "*";
  path: string;                          // original, for diagnostics
  segments: Segment[];
  match?: MatchCondition[];
  response: MockResponse;
  responses?: ResponseVariants;          // plan 10 — absent means "not stateful"
  callback?: CallbackConfig;             // plan 12 — absent means "no callback"
}

/** Plan 07. Passive data on ProjectConfig: `resolve()` never reads it — the
 *  proxy fallback is decided in the mock route, strictly *after* resolve()
 *  returns notFound, so turning it on can never change a matched request. */
export interface UpstreamConfig {
  /** Validated `https://` URL with a public hostname (src/proxy/ssrf.ts). */
  url: string;
  mode: "off" | "record" | "passthrough";
  /** Forward the caller's Authorization header to the upstream. Default false. */
  forwardAuth: boolean;
  /** Hard-capped at 5000 by the forwarder regardless of this value. */
  timeoutMs: number;
}

/** Plan 11 — fault injection. Passive data on ProjectConfig: resolve() never
 *  reads it; faults are applied in the mock route after the response is built. */
export interface FaultsConfig {
  enabled: boolean;
  latency?: {
    mode: "fixed" | "jitter" | "spike";
    baseMs: number;
    jitterMs: number;
    spike?: { percent: number; ms: number };
  };
  errorRate?: { percent: number; status: number; body?: unknown };
  malformed?: { percent: number; mode: "truncate" | "invalidJson" | "emptyBody" };
  seed?: string;
}

export interface ProjectConfig {
  name: string;
  slug: string;
  basePath?: string;
  defaults: {
    delayMs: number;
    cors: boolean;
    notFound: MockResponse;
  };
  routes: Route[];
  openApiDoc?: unknown;                  // merged OpenAPI, if any
  upstream?: UpstreamConfig;             // plan 07 — absent means "off"
  faults?: FaultsConfig;                 // plan 11 — absent / enabled:false means "off"
  variables?: ProjectVariable[];         // plan 17
  defaultEnvironment?: string;           // plan 17 — used when x-mirage-env is absent
}

export interface ResolveResult {
  status: number;
  headers: Record<string, string>;
  body: unknown;
  matchedRuleId: string | null;
  delayMs: number;
  warnings: string[];                    // runtime template warnings
  /** Plan 10: the matched route and the template context that built the
   *  response, so the mock route can hand a *different* variant to
   *  src/state/apply.ts without re-running resolve(). Undefined on notFound.
   *  resolve() itself never reads these back. */
  matchedRoute?: Route;
  templateContext?: TemplateContext;
}

export interface TemplateContext {
  body: unknown;
  path: Record<string, string>;
  query: Record<string, string>;
  header: Record<string, string>;
  /** Plan 17: project variables resolved for the request's environment.
   *  Absent → `{{vars.*}}` renders empty with a warning, like any missing token. */
  vars?: Record<string, unknown>;
}

/** Plan 17. Variables belong to the project and are shared; `overrides` swap
 *  the value per environment (selected by the `x-mirage-env` header). A
 *  `secret` variable is never returned by a read API and is rejected at save
 *  if referenced in a response body. */
export interface ProjectVariable {
  key: string;
  value?: unknown;
  scope: "project";
  secret?: boolean;
  overrides?: Record<string, unknown>;
}
