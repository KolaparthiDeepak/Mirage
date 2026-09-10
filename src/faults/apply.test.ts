import { describe, it, expect } from "vitest";
import type { FaultsConfig } from "../engine/types";
import { computeFaults, faultRng, mangleBody, mulberry32 } from "./apply";

const rng0 = () => 0; // always "hit" the lowest bucket
const rng1 = () => 0.999; // never hit a low-probability event

describe("computeFaults — latency", () => {
  it("fixed latency returns baseMs", () => {
    const f: FaultsConfig = { enabled: true, latency: { mode: "fixed", baseMs: 120, jitterMs: 0 } };
    expect(computeFaults(f, rng1).extraDelayMs).toBe(120);
  });

  it("jitter stays inside base ± jitter across many samples", () => {
    const f: FaultsConfig = { enabled: true, latency: { mode: "jitter", baseMs: 100, jitterMs: 30 } };
    const rng = mulberry32(1);
    for (let i = 0; i < 200; i++) {
      const d = computeFaults(f, rng).extraDelayMs;
      expect(d).toBeGreaterThanOrEqual(70);
      expect(d).toBeLessThanOrEqual(130);
    }
  });

  it("spike adds ms only when the draw is under percent", () => {
    const f: FaultsConfig = { enabled: true, latency: { mode: "spike", baseMs: 20, jitterMs: 0, spike: { percent: 1, ms: 2000 } } };
    expect(computeFaults(f, rng0).extraDelayMs).toBe(2020); // hit
    expect(computeFaults(f, rng1).extraDelayMs).toBe(20); // miss
  });

  it("caps injected latency at 5000ms", () => {
    const f: FaultsConfig = { enabled: true, latency: { mode: "fixed", baseMs: 999999, jitterMs: 0 } };
    expect(computeFaults(f, rng1).extraDelayMs).toBe(5000);
  });
});

describe("computeFaults — errors and malformed", () => {
  it("overrides the response when the draw is under errorRate.percent", () => {
    const f: FaultsConfig = { enabled: true, errorRate: { percent: 100, status: 503, body: { down: true } } };
    expect(computeFaults(f, rng0).override).toEqual({ status: 503, body: { down: true } });
    expect(computeFaults({ enabled: true, errorRate: { percent: 0, status: 503 } }, rng0).override).toBeUndefined();
  });

  it("does not also malform when an error was injected", () => {
    const f: FaultsConfig = {
      enabled: true,
      errorRate: { percent: 100, status: 500 },
      malformed: { percent: 100, mode: "truncate" },
    };
    const out = computeFaults(f, rng0);
    expect(out.override).toBeDefined();
    expect(out.malform).toBeUndefined();
  });
});

describe("seeded determinism", () => {
  it("a seeded error rate produces an identical failure sequence across two runs", () => {
    const f: FaultsConfig = { enabled: true, seed: "release-42", errorRate: { percent: 20, status: 503 } };
    const run = () =>
      Array.from({ length: 40 }, (_, i) => !!computeFaults(f, faultRng(f, "r", i + 1)).override);
    expect(run()).toEqual(run());
    expect(run().filter(Boolean).length).toBeGreaterThan(2);
  });

  it("faultRng without a seed is Math.random", () => {
    expect(faultRng({ enabled: true }, "r", 5)).toBe(Math.random);
  });
});

describe("mangleBody", () => {
  const rng = () => 0.5;
  it("emptyBody → empty string", () => {
    expect(mangleBody('{"a":1}', "emptyBody", rng)).toBe("");
  });
  it("truncate → a prefix of the body", () => {
    const out = mangleBody('{"hello":"world"}', "truncate", rng);
    expect('{"hello":"world"}'.startsWith(out)).toBe(true);
    expect(out.length).toBeLessThan('{"hello":"world"}'.length);
  });
  it("invalidJson → drops the closing brace", () => {
    expect(mangleBody('{"a":1}', "invalidJson", rng)).toBe('{"a":1');
  });
});
