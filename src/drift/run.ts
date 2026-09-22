// Plan 22 — orchestrates one full drift check for a project: probes every
// eligible rule sequentially (never parallel — the plan's own safety rule),
// then the spec diff if configured. Each rule's report is upserted or
// cleared independently, so one rule's failure never blocks another's.
// Imported from to-route.ts directly, not from ../compile/compile: that
// file also pulls in @apidevtools/swagger-parser (via expandOpenApi), which
// this module must never depend on — see to-route.ts's own comment for why.
import { toRoute } from "../compile/to-route";
import { probeRule } from "./probe";
import { compareSpecs, fetchUpstreamSpec } from "./spec-diff";
import type { DriftFinding } from "./types";
import type { Store, StoredDriftReport, StoredProject } from "../store/types";

/** Reserved ruleId for the project-wide spec-drift report — never a real
 *  rule id (ruleSchema requires a non-empty id with no such convention, but
 *  double underscores keep this visually distinct from anything a rule could
 *  plausibly be named). */
export const SPEC_REPORT_ID = "__openapi_spec__";

function contentUnchanged(existing: StoredDriftReport | null, findings: DriftFinding[], error: string | null): existing is StoredDriftReport {
  return existing !== null && existing.error === error && JSON.stringify(existing.findings) === JSON.stringify(findings);
}

/** A clean check (no findings, no error) clears any prior report — the drift
 *  table only ever holds what's currently wrong. Otherwise upsert, keeping
 *  `dismissed`/`firstSeenAt` when the content is exactly what was last
 *  checked (dismiss-until-it-changes-again), resetting both when it isn't. */
async function upsertOrClear(
  store: Store,
  slug: string,
  ruleId: string,
  findings: DriftFinding[],
  observedResponse: { status: number; body: unknown } | null,
  error: string | null,
  now: string,
): Promise<void> {
  if (findings.length === 0 && error === null) {
    await store.deleteDriftReport(slug, ruleId);
    return;
  }
  const existing = await store.getDriftReport(slug, ruleId);
  const unchanged = contentUnchanged(existing, findings, error);
  await store.saveDriftReport({
    id: ruleId,
    slug,
    ruleId,
    findings,
    observedResponse,
    error,
    dismissed: unchanged ? existing.dismissed : false,
    firstSeenAt: unchanged ? existing.firstSeenAt : now,
    lastCheckedAt: now,
  });
}

export interface DriftCheckSummary {
  checked: number;
  skipped: number;
  findingsCount: number;
  errored: number;
}

/** No-op (all zeros) when drift isn't enabled or there's no active upstream
 *  to check against — callers don't need to pre-check this themselves. */
export async function runDriftCheck(store: Store, project: StoredProject): Promise<DriftCheckSummary> {
  const summary: DriftCheckSummary = { checked: 0, skipped: 0, findingsCount: 0, errored: 0 };
  const driftConfig = project.drift;
  const upstream = project.upstream;
  if (!driftConfig?.enabled || !upstream || upstream.mode === "off") return summary;

  const now = new Date().toISOString();

  for (const rule of [...project.rules].sort((a, b) => a.position - b.position)) {
    const route = toRoute(rule.definition);
    const outcome = await probeRule({
      slug: project.slug,
      basePath: project.basePath,
      route,
      upstream,
      drift: driftConfig,
      openApiDoc: project.openApiDoc,
    });

    if ("skipped" in outcome) {
      summary.skipped += 1;
      continue;
    }
    if ("error" in outcome) {
      summary.errored += 1;
      await upsertOrClear(store, project.slug, rule.ruleId, [], null, outcome.error, now);
      continue;
    }
    summary.checked += 1;
    summary.findingsCount += outcome.findings.length;
    await upsertOrClear(store, project.slug, rule.ruleId, outcome.findings, outcome.observedResponse, null, now);
  }

  if (driftConfig.specUrl) {
    const fetched = await fetchUpstreamSpec(upstream.url, driftConfig.specUrl, upstream.timeoutMs);
    if ("error" in fetched) {
      summary.errored += 1;
      await upsertOrClear(store, project.slug, SPEC_REPORT_ID, [], null, fetched.error, now);
    } else {
      const findings = compareSpecs(project.openApiDoc, fetched.doc);
      summary.findingsCount += findings.length;
      await upsertOrClear(store, project.slug, SPEC_REPORT_ID, findings, null, null, now);
    }
  }

  return summary;
}

export interface ProjectDriftSweepOutcome extends DriftCheckSummary {
  slug: string;
}

/** Sweeps every project whose drift config is enabled and whose schedule
 *  isn't "manual". Extracted so the HTTP cron route (plan 22,
 *  app/api/cron/drift) and the self-host in-process scheduler (plan 20)
 *  share one implementation rather than two that could drift — the only
 *  difference between them is what triggers this call. */
export async function sweepAllDrift(store: Store): Promise<ProjectDriftSweepOutcome[]> {
  const summaries = await store.listProjects();
  const results: ProjectDriftSweepOutcome[] = [];
  for (const summary of summaries) {
    const project = await store.getProject(summary.slug);
    if (!project?.drift?.enabled || project.drift.schedule === "manual") continue;
    const outcome = await runDriftCheck(store, project);
    results.push({ slug: project.slug, ...outcome });
  }
  return results;
}
