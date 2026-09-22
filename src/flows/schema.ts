// Plan 16 — flow definitions. Standalone from src/compile/schema.ts: a flow
// is not part of the compiled project (it never becomes a Route), it is a
// saved, runnable list of requests against the already-compiled project.
import { z } from "zod";

const slugRe = /^[a-z0-9][a-z0-9-]{0,62}$/;

// Assertions reuse the existing operator vocabulary (equals/contains/regex/
// exists) rather than inventing a second one — one mental model for matching
// and for asserting.
const jsonPathAssertion = z
  .object({
    jsonPath: z.string().min(1),
    equals: z.unknown().optional(),
    contains: z.unknown().optional(),
    regex: z.string().optional(),
    exists: z.boolean().optional(),
  })
  .strict()
  .superRefine((obj, ctx) => {
    const ops = ["equals", "contains", "regex", "exists"].filter((k) => k in obj);
    if (ops.length !== 1) ctx.addIssue({ code: "custom", message: "exactly one of equals/contains/regex/exists required" });
  });

export const flowAssertionSchema = z.union([
  z.object({ status: z.number().int().min(100).max(599) }).strict(),
  // matchedRule: asserts *which rule served the response*, from x-mock-rule-id
  // — not just "got a 200" but "got the 200 I meant to get".
  z.object({ matchedRule: z.string().min(1) }).strict(),
  jsonPathAssertion,
]);

export const flowCaptureSchema = z
  .object({ name: z.string().regex(/^[A-Za-z0-9_-]+$/, "capture name must match ^[A-Za-z0-9_-]+$"), from: z.string().min(1) })
  .strict();

export const flowStepSchema = z
  .object({
    name: z.string().min(1),
    request: z
      .object({
        method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
        path: z.string().startsWith("/", "path must start with /"),
        headers: z.record(z.string()).optional(),
        body: z.unknown().optional(),
      })
      .strict(),
    assert: z.array(flowAssertionSchema).default([]),
    capture: z.array(flowCaptureSchema).default([]),
    continueOnFailure: z.boolean().default(false),
  })
  .strict();

export const flowSchema = z
  .object({
    id: z.string().regex(slugRe, "flow id must match ^[a-z0-9][a-z0-9-]{0,62}$"),
    name: z.string().min(1),
    // 50-step cap (plan 16 risk table): "flows become a general test framework"
    // is guarded by keeping this small and scripting-free, not by size alone,
    // but a bound here keeps one run's cost bound too.
    steps: z.array(flowStepSchema).min(1).max(50),
  })
  .strict();

export type FlowAssertion = z.infer<typeof flowAssertionSchema>;
export type FlowCapture = z.infer<typeof flowCaptureSchema>;
export type FlowStep = z.infer<typeof flowStepSchema>;
export type Flow = z.infer<typeof flowSchema>;
