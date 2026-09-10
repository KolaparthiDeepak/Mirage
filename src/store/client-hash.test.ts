import { describe, expect, it } from "vitest";
import { clientHash, clientIp } from "./client-hash";

describe("clientIp", () => {
  it("takes the first entry of x-forwarded-for", () => {
    const h = new Headers({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" });
    expect(clientIp(h)).toBe("1.2.3.4");
  });
  it("falls back to x-real-ip", () => {
    const h = new Headers({ "x-real-ip": "9.9.9.9" });
    expect(clientIp(h)).toBe("9.9.9.9");
  });
  it("returns null with neither header", () => {
    expect(clientIp(new Headers())).toBeNull();
  });
});

describe("clientHash", () => {
  it("is deterministic for the same ip and day", () => {
    const day = new Date("2026-01-01T00:00:00.000Z");
    expect(clientHash("1.2.3.4", day)).toBe(clientHash("1.2.3.4", day));
  });
  it("differs across days for the same ip", () => {
    const a = clientHash("1.2.3.4", new Date("2026-01-01T00:00:00.000Z"));
    const b = clientHash("1.2.3.4", new Date("2026-01-02T00:00:00.000Z"));
    expect(a).not.toBe(b);
  });
  it("differs across ips on the same day", () => {
    const day = new Date("2026-01-01T00:00:00.000Z");
    expect(clientHash("1.2.3.4", day)).not.toBe(clientHash("5.6.7.8", day));
  });
  it("is exactly 12 hex characters", () => {
    expect(clientHash("1.2.3.4")).toMatch(/^[0-9a-f]{12}$/);
  });
  it("returns null for a missing ip", () => {
    expect(clientHash(null)).toBeNull();
  });
});
