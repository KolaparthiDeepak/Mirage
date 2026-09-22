// Plan 21 — alert evaluation and the cooldown/recovery state machine. Pure
// with respect to time: every function takes `now` so the cron sweep, the
// Test button, and tests all go through the same code with a deterministic
// clock.
import { resolveBuiltinViewQuery } from "../views/builtins";
import { notifyAlert } from "./notify";
import type { Store, StoredAlert, TrafficFilter } from "../store/types";

const MS_PER_MINUTE = 60_000;

export interface EvaluationResult {
  firing: boolean;
  reason: string;
}

async function resolveViewQuery(store: Store, slug: string, viewId: string): Promise<Omit<TrafficFilter, "slug"> | null> {
  const builtin = resolveBuiltinViewQuery(viewId);
  if (builtin) return builtin;
  const stored = await store.getView(slug, viewId);
  return stored ? (stored.query as Omit<TrafficFilter, "slug">) : null;
}

/** One evaluation of an alert's condition against the live traffic store —
 *  no side effects, no state read or written. */
export async function evaluateAlert(store: Store, alert: StoredAlert, now: Date): Promise<EvaluationResult> {
  const query = await resolveViewQuery(store, alert.slug, alert.view);
  if (!query) return { firing: false, reason: `view "${alert.view}" not found` };

  const since = new Date(now.getTime() - alert.condition.windowMinutes * MS_PER_MINUTE).toISOString();

  if (alert.condition.kind === "silence") {
    const count = await store.countTraffic({ ...query, slug: alert.slug, since });
    return {
      firing: count === 0,
      reason: count === 0 ? `no matching requests in the last ${alert.condition.windowMinutes}m` : `${count} matching request(s) in the last ${alert.condition.windowMinutes}m`,
    };
  }

  if (alert.condition.kind === "unmatched") {
    const count = await store.countTraffic({ ...query, slug: alert.slug, since });
    return {
      firing: count > alert.condition.gt,
      reason: `${count} matching request(s) in the last ${alert.condition.windowMinutes}m (threshold > ${alert.condition.gt})`,
    };
  }

  // errorRate: the condition itself defines "error" as 5xx, so any
  // statusFrom/statusTo already on the view are dropped — otherwise a view
  // scoped to "errors" would always read back as a 100% error rate.
  const { statusFrom: _statusFrom, statusTo: _statusTo, ...scope } = query;
  const total = await store.countTraffic({ ...scope, slug: alert.slug, since });
  const errors = await store.countTraffic({ ...scope, slug: alert.slug, since, statusFrom: 500, statusTo: 599 });
  const rate = total === 0 ? 0 : errors / total;
  return {
    firing: rate > alert.condition.gt,
    reason: `${errors}/${total} requests errored in the last ${alert.condition.windowMinutes}m (${(rate * 100).toFixed(1)}%, threshold > ${(alert.condition.gt * 100).toFixed(0)}%)`,
  };
}

export interface SweepOutcome {
  alertId: string;
  slug: string;
  firing: boolean;
  notified: boolean;
  error?: string;
}

/** Evaluate one alert and, if its firing/recovered state changed (or the
 *  cooldown has elapsed while still firing), notify and persist the new
 *  state. Never throws — a broken view or an unreachable webhook surfaces as
 *  `lastError` on the alert row, not an exception the sweep loop must catch. */
export async function sweepAlert(store: Store, alert: StoredAlert, now: Date = new Date()): Promise<SweepOutcome> {
  const result = await evaluateAlert(store, alert, now);

  if (!result.firing) {
    if (!alert.currentlyFiring) return { alertId: alert.id, slug: alert.slug, firing: false, notified: false };

    // Recovery-once: this notification fires exactly on the firing ->
    // not-firing transition, never again on subsequent quiet sweeps.
    const notified = await notifyAlert(alert, "recovered", result.reason);
    await store.updateAlertState(alert.slug, alert.id, {
      lastFiredAt: alert.lastFiredAt,
      lastRecoveredAt: now.toISOString(),
      lastError: notified.ok ? null : (notified.error ?? null),
      currentlyFiring: false,
    });
    return { alertId: alert.id, slug: alert.slug, firing: false, notified: notified.ok, error: notified.ok ? undefined : notified.error };
  }

  const cooldownMs = alert.cooldownMinutes * MS_PER_MINUTE;
  const withinCooldown =
    alert.currentlyFiring && alert.lastFiredAt !== null && now.getTime() - new Date(alert.lastFiredAt).getTime() < cooldownMs;
  if (withinCooldown) return { alertId: alert.id, slug: alert.slug, firing: true, notified: false };

  const notified = await notifyAlert(alert, "firing", result.reason);
  await store.updateAlertState(alert.slug, alert.id, {
    lastFiredAt: now.toISOString(),
    lastRecoveredAt: alert.lastRecoveredAt,
    lastError: notified.ok ? null : (notified.error ?? null),
    currentlyFiring: true,
  });
  return { alertId: alert.id, slug: alert.slug, firing: true, notified: notified.ok, error: notified.ok ? undefined : notified.error };
}

/** Sweeps every enabled alert across every project. Extracted so the HTTP
 *  cron route (plan 21, app/api/cron/alerts) and the self-host in-process
 *  scheduler (plan 20) share one implementation rather than two that could
 *  drift — the only difference between them is what triggers this call. */
export async function sweepAllAlerts(store: Store, now: Date = new Date()): Promise<SweepOutcome[]> {
  const alerts = await store.listAllEnabledAlerts();
  return Promise.all(alerts.map((alert) => sweepAlert(store, alert, now)));
}
