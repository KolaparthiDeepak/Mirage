import { describe, expect, it } from "vitest";
import { mockBaseUrl } from "./mock-url";

describe("mockBaseUrl", () => {
  it("joins origin, /m/, slug and basePath", () => {
    expect(mockBaseUrl("card-block-lost", undefined, "http://localhost:3000")).toBe(
      "http://localhost:3000/m/card-block-lost",
    );
    expect(mockBaseUrl("card-block-lost", "/v1", "https://example.com")).toBe(
      "https://example.com/m/card-block-lost/v1",
    );
  });

  it("falls back to an empty origin off-window (SSR)", () => {
    expect(mockBaseUrl("s", "/bp", "")).toBe("/m/s/bp");
  });
});
