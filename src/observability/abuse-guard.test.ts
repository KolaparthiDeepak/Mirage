import { afterEach, describe, expect, it } from "vitest";
import { allowMockRequest, __resetMockRateLimit } from "./abuse-guard";

afterEach(() => __resetMockRateLimit());

describe("allowMockRequest", () => {
  it("allows requests under the limit", () => {
    for (let i = 0; i < 5; i++) expect(allowMockRequest("client-a", 5)).toBe(true);
  });

  it("refuses once a client is over its limit within the window", () => {
    for (let i = 0; i < 5; i++) allowMockRequest("client-b", 5);
    expect(allowMockRequest("client-b", 5)).toBe(false);
  });

  it("tracks separate clients independently", () => {
    for (let i = 0; i < 5; i++) allowMockRequest("client-c", 5);
    expect(allowMockRequest("client-c", 5)).toBe(false);
    expect(allowMockRequest("client-d", 5)).toBe(true);
  });
});
