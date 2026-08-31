import { describe, expect, it } from "vitest";
import { applyEnv } from "./env-url";

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
