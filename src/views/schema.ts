// Plan 21 — validation for saved views and alerts. Standalone from
// src/compile/schema.ts: neither a view nor an alert becomes part of a
// compiled project (compileMocks never reads them) — they read the traffic
// store, not the mock engine.
import { z } from "zod";

const idRe = /^[a-z0-9][a-z0-9-]{0,62}$/;

/** The same filter vocabulary as TrafficFilter (src/store/types.ts), minus
 *  the pagination/identity fields (slug, id, limit, before, since) that only
 *  make sense for one live request, never for a saved definition. */
export const viewQuerySchema = z
  .object({
    unmatchedOnly: z.boolean().optional(),
    viaUpstreamOnly: z.boolean().optional(),
    method: z.string().optional(),
    ruleId: z.string().optional(),
    pathContains: z.string().optional(),
    statusFrom: z.number().int().min(100).max(599).optional(),
    statusTo: z.number().int().min(100).max(599).optional(),
    durationMsFrom: z.number().int().min(0).optional(),
  })
  .strict();

export const savedViewSchema = z.object({
  id: z.string().regex(idRe, "view id must match ^[a-z0-9][a-z0-9-]{0,62}$"),
  name: z.string().min(1),
  query: viewQuerySchema,
});

export type SavedViewInput = z.infer<typeof savedViewSchema>;

const notifySchema = z
  .object({
    webhook: z.string().url().optional(),
    slack: z.string().url().optional(),
    discord: z.string().url().optional(),
  })
  .strict()
  .refine((n) => Boolean(n.webhook || n.slack || n.discord), {
    message: "at least one of webhook/slack/discord is required",
  });

const conditionSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("unmatched"),
      gt: z.number().int().min(0),
      windowMinutes: z.number().int().min(1).max(1440),
    })
    .strict(),
  z
    .object({
      kind: z.literal("errorRate"),
      // A fraction (0..1), not a percentage — 0.5 means "more than half".
      gt: z.number().min(0).max(1),
      windowMinutes: z.number().int().min(1).max(1440),
    })
    .strict(),
  z
    .object({
      kind: z.literal("silence"),
      windowMinutes: z.number().int().min(1).max(1440),
    })
    .strict(),
]);

export const alertSchema = z.object({
  id: z.string().regex(idRe, "alert id must match ^[a-z0-9][a-z0-9-]{0,62}$"),
  name: z.string().min(1),
  /** A built-in view id ("unmatched" | "errors" | "slow") or a saved view's id. */
  view: z.string().min(1),
  condition: conditionSchema,
  notify: notifySchema,
  cooldownMinutes: z.number().int().min(1).max(1440).default(30),
  enabled: z.boolean().default(true),
});

export type AlertInput = z.infer<typeof alertSchema>;

/** PATCH allows updating any subset of the same fields except `id`. */
export const alertPatchSchema = alertSchema.omit({ id: true }).partial();
