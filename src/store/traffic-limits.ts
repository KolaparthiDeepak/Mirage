// Plan 04, "Truncation and retention": numbers here are configurable defaults,
// not constants (design doc §8, decision 6) — every one is overridable by an
// environment variable so tuning them later is configuration, not a deploy.
export function maxBodyBytes(): number {
  return Number(process.env.MIRAGE_TRAFFIC_MAX_BODY_BYTES ?? 64 * 1024);
}

export function retentionDays(): number {
  return Number(process.env.MIRAGE_TRAFFIC_RETENTION_DAYS ?? 7);
}

export function retentionMaxRows(): number {
  return Number(process.env.MIRAGE_TRAFFIC_RETENTION_MAX_ROWS ?? 10_000);
}

export function sampleThresholdPerMinute(): number {
  return Number(process.env.MIRAGE_TRAFFIC_SAMPLE_THRESHOLD ?? 100);
}

function isUtf8ContinuationByte(b: number): boolean {
  return (b & 0xc0) === 0x80; // 10xxxxxx
}

/** Byte length of the UTF-8 sequence starting at a lead byte. */
function utf8SequenceLength(b: number): number {
  if ((b & 0x80) === 0x00) return 1; // 0xxxxxxx
  if ((b & 0xe0) === 0xc0) return 2; // 110xxxxx
  if ((b & 0xf0) === 0xe0) return 3; // 1110xxxx
  if ((b & 0xf8) === 0xf0) return 4; // 11110xxx
  return 1; // not a valid lead byte; Buffer.from(str, "utf8") never emits one
}

/** Truncates a body string to the byte limit, UTF-8 aware (never splits a
 *  multi-byte character), and marks it. `null` in, `null` out — nothing to
 *  truncate.
 *
 *  `Buffer#toString("utf8")` does NOT drop a trailing chopped multi-byte
 *  sequence — it substitutes the replacement character U+FFFD for it, which
 *  re-encodes to *more* bytes than the slice that produced it. Naively
 *  slicing to `maxBytes` and calling `.toString()` can therefore return a
 *  string whose own byte length exceeds the limit it was meant to enforce.
 *  This walks back to the last full character before slicing instead. */
export function truncateBody(body: string | null, maxBytes = maxBodyBytes()): { body: string | null; truncated: boolean } {
  if (body == null) return { body: null, truncated: false };
  const buf = Buffer.from(body, "utf8");
  if (buf.byteLength <= maxBytes) return { body, truncated: false };

  let end = maxBytes;
  let lead = end - 1;
  while (lead >= 0 && isUtf8ContinuationByte(buf[lead]!)) lead--;
  if (lead >= 0 && lead + utf8SequenceLength(buf[lead]!) > end) {
    end = lead; // that character doesn't fully fit — drop it entirely, not just its tail
  }
  return { body: buf.subarray(0, end).toString("utf8"), truncated: true };
}

// Sampling counters are per-instance and reset every minute — plan 04 asks for
// a "deterministic sample," not cross-instance-accurate statistics. Good
// enough to bound write volume under load; plan 24 revisits the numbers.
const counters = new Map<string, { minute: number; count: number }>();

function currentMinute(): number {
  return Math.floor(Date.now() / 60_000);
}

/** True if this request should be recorded. Unmatched requests and 5xx
 *  responses are always recorded (plan 04: "always keep 100% of unmatched
 *  requests and 100% of 5xx"); everything else above the per-minute threshold
 *  is deterministically thinned. */
export function shouldRecord(slug: string, status: number, matched: boolean, threshold = sampleThresholdPerMinute()): boolean {
  if (!matched || status >= 500) return true;

  const minute = currentMinute();
  let entry = counters.get(slug);
  if (!entry || entry.minute !== minute) {
    entry = { minute, count: 0 };
    counters.set(slug, entry);
  }
  entry.count++;
  if (entry.count <= threshold) return true;

  // Beyond the threshold: keep roughly one in every (count / threshold) —
  // deterministic per (slug, minute, count), not random, so a specific
  // request's fate is reproducible from the same inputs.
  const keepEvery = Math.ceil(entry.count / threshold);
  return entry.count % keepEvery === 0;
}

/** Test-only. */
export function clearSamplingCounters(): void {
  counters.clear();
}
