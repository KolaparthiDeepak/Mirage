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

export const projectYamlSchema = z
  .object({
    name: z.string().min(1),
    slug: z.string().regex(slugRe, "slug must match ^[a-z0-9][a-z0-9-]{0,62}$"),
    upstream: upstreamSchema.optional(),
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
    response: mockResponseSchema,
  })
  .strict();

export const ruleFileSchema = z.array(ruleSchema);

export type ProjectYaml = z.infer<typeof projectYamlSchema>;
export type Rule = z.infer<typeof ruleSchema>;
