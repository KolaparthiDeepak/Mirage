import { describe, expect, it } from "vitest";
import { applyEnv, stripEnv } from "./env-url";

describe("applyEnv", () => {
  it("prefixes a relative url and trims a trailing slash off baseUrl", () => {
    expect(applyEnv("/m/x?q=1", { baseUrl: "https://qa.example.com/" })).toBe(
      "https://qa.example.com/m/x?q=1",
    );
  });

  it("adds a missing leading slash on a relative url", () => {
    expect(applyEnv("m/x", { baseUrl: "https://qa.example.com" })).toBe(
      "https://qa.example.com/m/x",
    );
  });

  it("swaps the origin of an absolute url, keeping path+search", () => {
    expect(applyEnv("http://localhost:3000/m/x", { baseUrl: "https://qa.example.com" })).toBe(
      "https://qa.example.com/m/x",
    );
  });

  it("preserves the hash", () => {
    expect(applyEnv("http://localhost:3000/m/x#frag", { baseUrl: "https://qa.example.com" })).toBe(
      "https://qa.example.com/m/x#frag",
    );
  });
});

describe("stripEnv round-trip", () => {
  it("preserves path + query", () => {
    const env = { baseUrl: "https://qa.example.com" };
    expect(stripEnv(applyEnv("/m/x?q=1", env), "http://localhost:3000")).toBe(
      "http://localhost:3000/m/x?q=1",
    );
  });

  it("preserves the hash", () => {
    const env = { baseUrl: "https://qa.example.com" };
    expect(stripEnv(applyEnv("/m/x?q=1#h", env), "http://localhost:3000")).toBe(
      "http://localhost:3000/m/x?q=1#h",
    );
  });
});
