// Plan 24 — a small structured logger for the mock route's own request log
// line, replacing the two ad-hoc `console.log(JSON.stringify(...))` call
// sites that used to build this object inline in two slightly different
// shapes. Two rules, non-negotiable, both already true of the code this
// replaces — this just makes the contract a type instead of a convention to
// remember at every call site:
//
//   - Never a request/response body.
//   - Never a header value.
//
// MockLogEvent's fields are deliberately an allow-list, not "anything the
// caller wants to pass" — TypeScript's excess-property check on an object
// literal argument means adding a `body` field to a call site is a compile
// error, not a silent data leak into stdout.
export interface MockLogEvent {
  requestId: string;
  project: string;
  method: string;
  path: string;
  rule: string | null;
  status: number;
  matched: boolean;
  warnings: number;
  /** Set only on the upstream-proxied path (plan 07); omitted otherwise. */
  viaUpstream?: boolean;
}

export function logMockEvent(event: MockLogEvent): void {
  console.log(
    JSON.stringify({
      t: new Date().toISOString(),
      reqId: event.requestId,
      proj: event.project,
      m: event.method,
      path: event.path,
      rule: event.rule,
      status: event.status,
      matched: event.matched,
      warns: event.warnings,
      ...(event.viaUpstream !== undefined ? { upstream: event.viaUpstream } : {}),
    }),
  );
}
