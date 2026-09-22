// Plan 11 — compute the fault to inject for one request. Pure: given a
// FaultsConfig and a source of randomness, decide the extra latency, whether
// to force an error, and whether to mangle the body. The mock route applies
// the outcome after resolve()/applyState.

import type { FaultsConfig } from "../engine/types";

const LATENCY_CAP_MS = 5000;

/** mulberry32 — a tiny seeded PRNG. Used only when `faults.seed` is set, so a
 *  "5% error rate" is exactly every twentieth call in the same order. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** djb2 — stable string hash for seeding. */
export function hashSeed(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h;
}

/** For a project with a seed, a per-(rule, call) deterministic rng; otherwise
 *  Math.random. `callCount` is ignored without a seed. */
export function faultRng(faults: FaultsConfig, ruleId: string, callCount: number): () => number {
  if (!faults.seed) return Math.random;
  return mulberry32(hashSeed(`${faults.seed}:${ruleId}:${callCount}`));
}

export interface FaultOutcome {
  extraDelayMs: number;
  /** errorRate hit — replace the response with this. */
  override?: { status: number; body: unknown };
  /** malformed hit — how to mangle the serialized body. */
  malform?: "truncate" | "invalidJson" | "emptyBody";
  notes: string[];
}

export function computeFaults(faults: FaultsConfig, rng: () => number): FaultOutcome {
  const notes: string[] = [];
  let extraDelayMs = 0;

  const lat = faults.latency;
  if (lat) {
    if (lat.mode === "fixed") {
      extraDelayMs = lat.baseMs;
    } else if (lat.mode === "jitter") {
      extraDelayMs = Math.max(0, Math.round(lat.baseMs + (rng() * 2 - 1) * lat.jitterMs));
    } else if (lat.mode === "spike") {
      const spiking = lat.spike ? rng() < lat.spike.percent / 100 : false;
      extraDelayMs = lat.baseMs + (spiking ? lat.spike!.ms : 0);
      if (spiking) notes.push(`latency spike +${lat.spike!.ms}ms`);
    }
    extraDelayMs = Math.min(extraDelayMs, LATENCY_CAP_MS);
  }

  let override: FaultOutcome["override"];
  if (faults.errorRate && rng() < faults.errorRate.percent / 100) {
    override = { status: faults.errorRate.status, body: faults.errorRate.body ?? { error: "injected fault" } };
    notes.push(`error injected: ${override.status}`);
  }

  let malform: FaultOutcome["malform"];
  if (!override && faults.malformed && rng() < faults.malformed.percent / 100) {
    malform = faults.malformed.mode;
    notes.push(`malformed body: ${malform}`);
  }

  return { extraDelayMs, override, malform, notes };
}

/** Apply a `malform` outcome to the serialized response body. */
export function mangleBody(body: string | null, mode: "truncate" | "invalidJson" | "emptyBody", rng: () => number): string {
  if (mode === "emptyBody") return "";
  const s = body ?? "{}";
  if (mode === "truncate") {
    const cut = Math.max(1, Math.floor(rng() * s.length));
    return s.slice(0, cut);
  }
  // invalidJson: drop the final closing brace/bracket if there is one, else append junk.
  if (/[}\]]\s*$/.test(s)) return s.replace(/[}\]]\s*$/, "");
  return s + " <<";
}
