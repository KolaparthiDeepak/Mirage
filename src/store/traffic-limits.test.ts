import { afterEach, describe, expect, it } from "vitest";
import { clearSamplingCounters, shouldRecord, truncateBody } from "./traffic-limits";

describe("truncateBody", () => {
  it("passes a body under the limit through untouched", () => {
    expect(truncateBody("hello", 100)).toEqual({ body: "hello", truncated: false });
  });
  it("truncates a body over the limit and marks it", () => {
    const out = truncateBody("a".repeat(200), 100);
    expect(out.truncated).toBe(true);
    expect(Buffer.byteLength(out.body!, "utf8")).toBeLessThanOrEqual(100);
  });
  it("never splits a multi-byte character", () => {
    // "€" is 3 bytes in UTF-8; a limit landing mid-character must not corrupt it.
    const out = truncateBody("€".repeat(50), 10);
    expect(Buffer.byteLength(out.body!, "utf8")).toBeLessThanOrEqual(10);
    expect(out.body).toBe(Buffer.from(out.body!, "utf8").toString("utf8")); // round-trips cleanly, no replacement chars
  });
  it("passes null through unchanged", () => {
    expect(truncateBody(null)).toEqual({ body: null, truncated: false });
  });
});

describe("shouldRecord", () => {
  afterEach(() => clearSamplingCounters());

  it("always records an unmatched request, regardless of volume", () => {
    for (let i = 0; i < 500; i++) {
      expect(shouldRecord("proj", 404, false, 10)).toBe(true);
    }
  });

  it("always records a 5xx response, regardless of volume", () => {
    for (let i = 0; i < 500; i++) {
      expect(shouldRecord("proj", 503, true, 10)).toBe(true);
    }
  });

  it("records every matched, non-5xx request up to the threshold", () => {
    for (let i = 0; i < 10; i++) {
      expect(shouldRecord("proj", 200, true, 10)).toBe(true);
    }
  });

  it("thins matched, non-5xx traffic once over the threshold", () => {
    let recorded = 0;
    for (let i = 0; i < 100; i++) {
      if (shouldRecord("proj", 200, true, 10)) recorded++;
    }
    expect(recorded).toBeLessThan(100);
    expect(recorded).toBeGreaterThanOrEqual(10);
  });

  it("tracks each project's volume independently", () => {
    for (let i = 0; i < 10; i++) shouldRecord("busy", 200, true, 10);
    expect(shouldRecord("quiet", 200, true, 10)).toBe(true);
  });
});
