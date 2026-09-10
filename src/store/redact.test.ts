import { describe, expect, it } from "vitest";
import { looksLikeSecret, redactBody, redactHeaders } from "./redact";

describe("redactHeaders", () => {
  it("masks the default denylist, case-insensitively", () => {
    const out = redactHeaders({ Authorization: "Bearer abc", "X-Api-Key": "k", "x-note": "hello" });
    expect(out.Authorization).toBe("***");
    expect(out["X-Api-Key"]).toBe("***");
    expect(out["x-note"]).toBe("hello");
  });

  it("masks project-configured extra headers", () => {
    const out = redactHeaders({ "x-internal-token": "abc" }, { headers: ["x-internal-token"] });
    expect(out["x-internal-token"]).toBe("***");
  });

  it("masks a JWT-shaped value even on an unlisted header, via the heuristic", () => {
    const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dQw4w9WgXcQdozM5J3nvbC1Sq1abcdefgh";
    const out = redactHeaders({ "x-custom": jwt });
    expect(out["x-custom"]).toBe("***");
  });

  it("can disable the heuristic per project", () => {
    const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dQw4w9WgXcQdozM5J3nvbC1Sq1abcdefgh";
    const out = redactHeaders({ "x-custom": jwt }, { disableHeuristic: true });
    expect(out["x-custom"]).toBe(jwt);
  });

  it("leaves an ordinary short header value alone", () => {
    const out = redactHeaders({ "content-type": "application/json" });
    expect(out["content-type"]).toBe("application/json");
  });
});

describe("looksLikeSecret", () => {
  it("recognises a JWT shape", () => {
    expect(looksLikeSecret("aaaaaaaaaa.bbbbbbbbbb.cccccccccc")).toBe(true);
  });
  it("recognises a long opaque token", () => {
    expect(looksLikeSecret("a".repeat(40))).toBe(true);
  });
  it("does not flag an ordinary word", () => {
    expect(looksLikeSecret("application/json")).toBe(false);
  });
  it("does not flag a short id", () => {
    expect(looksLikeSecret("cust-ok")).toBe(false);
  });
});

describe("redactBody", () => {
  it("redacts a configured JSON path without touching siblings", () => {
    const body = JSON.stringify({ card: { number: "4111111111111111", last4: "1111" }, ok: true });
    const out = JSON.parse(redactBody(body, { bodyPaths: ["card.number"] })!);
    expect(out.card.number).toBe("***");
    expect(out.card.last4).toBe("1111");
    expect(out.ok).toBe(true);
  });

  it("redacts a top-level path", () => {
    const out = JSON.parse(redactBody(JSON.stringify({ password: "hunter2" }), { bodyPaths: ["password"] })!);
    expect(out.password).toBe("***");
  });

  it("is a no-op when the configured path does not exist", () => {
    const body = JSON.stringify({ a: 1 });
    expect(JSON.parse(redactBody(body, { bodyPaths: ["missing.path"] })!)).toEqual({ a: 1 });
  });

  it("redacts a JWT-shaped string value anywhere in the body via the heuristic", () => {
    const jwt = "aaaaaaaaaa.bbbbbbbbbb.cccccccccc";
    const out = JSON.parse(redactBody(JSON.stringify({ token: jwt, ok: true }))!);
    expect(out.token).toBe("***");
    expect(out.ok).toBe(true);
  });

  it("passes non-JSON text through untouched when it doesn't look like a secret", () => {
    expect(redactBody("plain text body")).toBe("plain text body");
  });

  it("redacts non-JSON text that looks like a bare secret", () => {
    expect(redactBody("a".repeat(40))).toBe("***");
  });

  it("passes null and empty string through unchanged", () => {
    expect(redactBody(null)).toBeNull();
    expect(redactBody("")).toBe("");
  });
});
