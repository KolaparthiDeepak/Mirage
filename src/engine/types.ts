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

export interface Route {
  id: string;
  method: HttpMethod | "*";
  path: string;                          // original, for diagnostics
  segments: Segment[];
  match?: MatchCondition[];
  response: MockResponse;
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
}

export interface ResolveResult {
  status: number;
  headers: Record<string, string>;
  body: unknown;
  matchedRuleId: string | null;
  delayMs: number;
  warnings: string[];                    // runtime template warnings
}
