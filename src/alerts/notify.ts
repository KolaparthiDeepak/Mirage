// Plan 21 — alert notification delivery. Reuses plan 07's SSRF guard and
// forwarder verbatim (one implementation, one test suite, N callers: plan 12's
// callbacks, and now alerts).
import { forwardToUpstream } from "../proxy/forward";
import { assertSafeUpstreamUrl, UpstreamError } from "../proxy/ssrf";
import type { StoredAlert } from "../store/types";

export type AlertEvent = "firing" | "recovered" | "test";

export interface NotifyResult {
  ok: boolean;
  error?: string;
}

async function send(url: string, payload: unknown): Promise<NotifyResult> {
  let target: URL;
  try {
    target = await assertSafeUpstreamUrl(url);
  } catch (e) {
    return { ok: false, error: e instanceof UpstreamError ? e.message : "notification URL failed validation" };
  }
  const res = await forwardToUpstream({
    targetUrl: target,
    method: "POST",
    reqHeaders: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    forwardAuth: false,
    timeoutMs: 5000,
  });
  if (res.error || res.status >= 400) {
    return { ok: false, error: res.error ?? `notification endpoint responded ${res.status}` };
  }
  return { ok: true };
}

function slackPayload(alert: StoredAlert, event: AlertEvent, reason: string): unknown {
  const emoji = event === "firing" ? ":rotating_light:" : event === "recovered" ? ":white_check_mark:" : ":test_tube:";
  return { text: `${emoji} *${alert.name}* (${alert.slug}) — ${event}\n${reason}` };
}

function discordPayload(alert: StoredAlert, event: AlertEvent, reason: string): unknown {
  return { content: `**${alert.name}** (${alert.slug}) — ${event}\n${reason}` };
}

function webhookPayload(alert: StoredAlert, event: AlertEvent, reason: string): unknown {
  return { alertId: alert.id, slug: alert.slug, name: alert.name, event, reason, at: new Date().toISOString() };
}

/** Sends to every configured destination; ok only if all of them succeed —
 *  a half-delivered alert is reported as an error so the operator notices,
 *  rather than assuming Slack got it when only the webhook did. */
export async function notifyAlert(alert: StoredAlert, event: AlertEvent, reason: string): Promise<NotifyResult> {
  const jobs: Promise<NotifyResult>[] = [];
  if (alert.notify.webhook) jobs.push(send(alert.notify.webhook, webhookPayload(alert, event, reason)));
  if (alert.notify.slack) jobs.push(send(alert.notify.slack, slackPayload(alert, event, reason)));
  if (alert.notify.discord) jobs.push(send(alert.notify.discord, discordPayload(alert, event, reason)));
  if (jobs.length === 0) return { ok: false, error: "no notification destination configured" };

  const results = await Promise.all(jobs);
  const failed = results.filter((r) => !r.ok);
  if (failed.length === 0) return { ok: true };
  return { ok: false, error: failed.map((f) => f.error).join("; ") };
}
