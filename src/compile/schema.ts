import { z } from "zod";
import { FORBIDDEN_PATH_TOKENS, jsonPathTokens } from "../engine/match";

const slugRe = /^[a-z0-9][a-z0-9-]{0,62}$/;

const mockResponseSchema = z
  .object({
    status: z.number().int().min(100).max(599),
    headers: z.record(z.string()).optional(),
    body: z.unknown().optional(),
  })
  .strict();

// Plan 10 — stateful variants. `response` (singular) stays the documented
// default; `responses` is additive, so every existing mock is untouched.
const whenSchema = z
  .object({
    callCount: z
      .object({ gte: z.number().int().min(0).optional(), lt: z.number().int().min(0).optional(), eq: z.number().int().min(0).optional() })
      .strict()
      .refine((o) => o.gte != null || o.lt != null || o.eq != null, "callCount needs gte, lt or eq"),
  })
  .strict();

const variantSchema = mockResponseSchema.extend({
  weight: z.number().positive().optional(),
  when: whenSchema.optional(),
});

export const responseVariantsSchema = z
  .object({
    strategy: z.enum(["sequence", "weighted", "conditional"]),
    variants: z.array(variantSchema).min(1),
    /** sequence only: after the last variant, repeat it (true, default) or cycle. */
    repeatLast: z.boolean().default(true),
    /** Header carrying the session key; default "x-mirage-session". */
    sessionHeader: z.string().min(1).optional(),
  })
  .strict()
  .superRefine((r, ctx) => {
    if (r.strategy === "weighted" && r.variants.some((v) => v.weight == null)) {
      ctx.addIssue({ code: "custom", message: "every variant needs a `weight` for the weighted strategy" });
    }
    if (r.strategy === "conditional" && r.variants.some((v) => v.when == null)) {
      ctx.addIssue({ code: "custom", message: "every variant needs a `when` for the conditional strategy" });
    }
  });

// Plan 07. `mode: off` (or omitting `upstream` entirely) is today's behaviour.
// The URL is only shape-checked here — the DNS-resolution / private-range check
// (src/proxy/ssrf.ts) is async and runs at save time and before every forward.
export const upstreamSchema = z
  .object({
    url: z
      .string()
      .url("upstream url must be a valid URL")
      .startsWith("https://", "upstream url must be https://"),
    mode: z.enum(["off", "record", "passthrough"]).default("off"),
    forwardAuth: z.boolean().default(false),
    timeoutMs: z.number().int().min(100).max(5000).default(5000),
  })
  .strict();

// Plan 11 — fault injection. Everything defaults off; a project without a
// `faults` block behaves exactly as before. The 5000 ms latency cap has
// headroom under vercel.json's maxDuration: 10.
const LATENCY_CAP_MS = 5000;

const latencySchema = z
  .object({
    mode: z.enum(["fixed", "jitter", "spike"]).default("fixed"),
    baseMs: z.number().int().min(0).default(0),
    jitterMs: z.number().int().min(0).default(0),
    spike: z.object({ percent: z.number().min(0).max(100), ms: z.number().int().min(0) }).strict().optional(),
  })
  .strict()
  .superRefine((l, ctx) => {
    const worst =
      l.mode === "jitter" ? l.baseMs + l.jitterMs : l.mode === "spike" ? l.baseMs + (l.spike?.ms ?? 0) : l.baseMs;
    if (worst > LATENCY_CAP_MS) {
      ctx.addIssue({
        code: "custom",
        message: `worst-case injected latency ${worst}ms exceeds the ${LATENCY_CAP_MS}ms cap (base ${l.baseMs} + ${
          l.mode === "jitter" ? `jitter ${l.jitterMs}` : `spike ${l.spike?.ms ?? 0}`
        })`,
      });
    }
  });

export const faultsSchema = z
  .object({
    enabled: z.boolean().default(false),
    latency: latencySchema.optional(),
    errorRate: z
      .object({
        percent: z.number().min(0).max(100),
        status: z.number().int().min(400).max(599).default(503),
        body: z.unknown().optional(),
      })
      .strict()
      .optional(),
    malformed: z
      .object({
        percent: z.number().min(0).max(100),
        mode: z.enum(["truncate", "invalidJson", "emptyBody"]).default("truncate"),
      })
      .strict()
      .optional(),
    /** When set, fault selection is `hash(seed + ruleId + callCount)` —
     *  reproducible across runs. Absent → genuine randomness. */
    seed: z.string().min(1).optional(),
  })
  .strict();

// Plan 17 — project variables. `{{vars.key}}` resolves from these at request
// time; `overrides` swap the value per environment.
export const projectVariableSchema = z
  .object({
    key: z.string().regex(/^[A-Za-z0-9_-]+$/, "variable key must match ^[A-Za-z0-9_-]+$"),
    value: z.unknown(),
    scope: z.literal("project").default("project"),
    secret: z.boolean().optional(),
    overrides: z.record(z.unknown()).optional(),
  })
  .strict();

// Plan 13 — contract validation against the project's OpenAPI doc.
export const contractSchema = z
  .object({
    /** Validate requests at request time. Defaults on for spec-backed
     *  projects (applied by the caller), off otherwise. */
    validate: z.boolean().optional(),
    /** Refuse a rule save whose response body contradicts the spec. */
    enforce: z.boolean().default(false),
    /** Return 400 for a request that violates the spec (opt-in). */
    rejectInvalid: z.boolean().default(false),
  })
  .strict();

export const projectYamlSchema = z
  .object({
    name: z.string().min(1),
    slug: z.string().regex(slugRe, "slug must match ^[a-z0-9][a-z0-9-]{0,62}$"),
    upstream: upstreamSchema.optional(),
    faults: faultsSchema.optional(),
    variables: z.array(projectVariableSchema).optional(),
    defaultEnvironment: z.string().min(1).optional(),
    contract: contractSchema.optional(),
    // Plan 09: fill schema-only OpenAPI responses with a deterministic fake
    // body. Default true; an existing project with examples throughout is
    // unaffected either way.
    fakeFromSchema: z.boolean().optional().default(true),
    // "/" means "no base path": keeping it would make every generated OpenAPI
    // route fall outside the basePath test in compile.ts and be dropped.
    basePath: z
      .string()
      .startsWith("/")
      .transform((s) => (s.endsWith("/") && s.length > 1 ? s.slice(0, -1) : s))
      .transform((s) => (s === "/" ? undefined : s))
      .optional(),
    defaults: z
      .object({
        delayMs: z.number().int().min(0).max(5000).optional(),
        cors: z.boolean().optional(),
        notFound: mockResponseSchema.optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

/** A group closed by `+`/`*`/`{n,}` that itself contains an unbounded quantifier —
 *  `(a+)+`, `(a*)*`, `(\\d+|x)*`. Catches the accidental case, not every ReDoS. */
const NESTED_QUANTIFIER_RE = /\([^()]*[+*][^()]*\)\s*(?:[+*]|\{\d+,\})/;

export function hasNestedQuantifier(source: string): boolean {
  return NESTED_QUANTIFIER_RE.test(source);
}

const TARGET_KEYS = ["jsonPath", "header", "query"] as const;
const OP_KEYS = ["equals", "notEquals", "contains", "regex", "exists"] as const;

const matchConditionSchema = z.record(z.unknown()).superRefine((obj, ctx) => {
  const targets = TARGET_KEYS.filter((k) => k in obj);
  const ops = OP_KEYS.filter((k) => k in obj);
  if (targets.length !== 1) ctx.addIssue({ code: "custom", message: `exactly one of ${TARGET_KEYS.join("/")} required` });
  if (ops.length !== 1) ctx.addIssue({ code: "custom", message: `exactly one of ${OP_KEYS.join("/")} required` });
  const known = [...TARGET_KEYS, ...OP_KEYS] as string[];
  const extra = Object.keys(obj).filter((k) => !known.includes(k));
  if (extra.length) ctx.addIssue({ code: "custom", message: `unknown key(s): ${extra.join(", ")}` });
  if ("regex" in obj) {
    if (typeof obj.regex !== "string") {
      ctx.addIssue({ code: "custom", message: "regex must be a string" });
    } else {
      try { new RegExp(obj.regex); }
      catch { ctx.addIssue({ code: "custom", message: `invalid regex: ${obj.regex}` }); }
      if (hasNestedQuantifier(obj.regex)) {
        ctx.addIssue({
          code: "custom",
          message: `regex has a nested unbounded quantifier and can backtrack catastrophically: ${obj.regex}`,
        });
      }
    }
  }
  if ("exists" in obj && typeof obj.exists !== "boolean") {
    ctx.addIssue({ code: "custom", message: "exists must be a boolean" });
  }
  if (typeof obj.jsonPath === "string") {
    const bad = jsonPathTokens(obj.jsonPath).find((t: string) => FORBIDDEN_PATH_TOKENS.has(t));
    if (bad) {
      ctx.addIssue({ code: "custom", message: `jsonPath may not traverse "${bad}"` });
    }
  }
});

// Plan 12 — callbacks. delayMs is capped at 5000 in this pass: that is the
// `waitUntil` path, which needs no queue infrastructure. Longer delays (the
// callback_queue + cron path) are a follow-up.
export const callbackSchema = z
  .object({
    url: z.string().url().startsWith("https://", "callback url must be https://"),
    method: z.enum(["POST", "PUT", "PATCH", "GET", "DELETE"]).default("POST"),
    delayMs: z.number().int().min(0).max(5000).default(0),
    headers: z.record(z.string()).optional(),
    body: z.unknown().optional(),
    retry: z
      .object({ attempts: z.number().int().min(1).max(3).default(1), backoffMs: z.number().int().min(0).max(5000).default(1000) })
      .strict()
      .optional(),
  })
  .strict();

export const ruleSchema = z
  .object({
    id: z.string().min(1),
    description: z.string().optional(),
    request: z
      .object({
        method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE", "*"]),
        path: z
          .string()
          .startsWith("/", "path must start with /")
          .refine(
            (p) => {
              const segs = p.split("/").filter((s) => s.length > 0);
              const i = segs.indexOf("**");
              return i === -1 || i === segs.length - 1;
            },
            "** must be the last path segment",
          ),
        match: z.array(matchConditionSchema).optional(),
      })
      .strict(),
    response: mockResponseSchema.optional(),
    responses: responseVariantsSchema.optional(),
    callback: callbackSchema.optional(),
  })
  .strict()
  .superRefine((r, ctx) => {
    if (!r.response === !r.responses) {
      ctx.addIssue({ code: "custom", message: "a rule needs exactly one of `response` or `responses`" });
    }
  });

export const ruleFileSchema = z.array(ruleSchema);

export type ProjectYaml = z.infer<typeof projectYamlSchema>;
export type Rule = z.infer<typeof ruleSchema>;
