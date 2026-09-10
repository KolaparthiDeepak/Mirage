import { describe, it, expect } from "vitest";
import { ruleSchema } from "../compile/schema";
import { parseHar } from "./har-parse";

function har(entries: unknown[]) {
  return JSON.stringify({ log: { version: "1.2", entries } });
}
function entry(method: string, url: string, status: number, mimeType: string, text?: string) {
  return { request: { method, url }, response: { status, content: { mimeType, text } } };
}
function ok(r: ReturnType<typeof parseHar>) {
  if ("error" in r) throw new Error(r.error);
  return r;
}

describe("parseHar", () => {
  it("collapses id path segments into :id and merges identical method+path", () => {
    const { drafts } = ok(
      parseHar(
        har([
          entry("GET", "https://api.example.com/users/8f3a1b2c-0000-4a00-8000-000000000001/orders", 200, "application/json", "[]"),
          entry("GET", "https://api.example.com/users/2b1c0000-0000-4a00-8000-000000000002/orders", 200, "application/json", "[]"),
        ]),
      ),
    );
    expect(drafts).toHaveLength(1);
    expect(drafts[0]!.rule.request.path).toBe("/users/:id/orders");
    expect(ruleSchema.safeParse(drafts[0]!.rule).success).toBe(true);
  });

  it("keeps the real JSON response body", () => {
    const { drafts } = ok(
      parseHar(har([entry("GET", "https://x/thing", 201, "application/json", '{"id":9,"name":"Ada"}')])),
    );
    expect(drafts[0]!.rule.response).toEqual({ status: 201, body: { id: 9, name: "Ada" } });
  });

  it("redacts secrets in the response body on import", () => {
    const token = "a".repeat(40);
    const { drafts } = ok(
      parseHar(har([entry("GET", "https://x/session", 200, "application/json", JSON.stringify({ token }))])),
    );
    expect(JSON.stringify(drafts[0]!.rule.response.body)).not.toContain(token);
    expect(JSON.stringify(drafts[0]!.rule.response.body)).toContain("***");
  });

  it("drops non-JSON/text entries by default and reports the count", () => {
    const { drafts, unsupported } = ok(
      parseHar(
        har([
          entry("GET", "https://x/api/data", 200, "application/json", "{}"),
          entry("GET", "https://x/logo.png", 200, "image/png"),
          entry("GET", "https://x/app.js", 200, "application/javascript"),
        ]),
      ),
    );
    expect(drafts).toHaveLength(1);
    expect(unsupported.some((u) => u.includes("2 entries skipped"))).toBe(true);
  });

  it("filters by host when includeHosts is given", () => {
    const { drafts } = ok(
      parseHar(
        har([
          entry("GET", "https://keep.me/a", 200, "application/json", "{}"),
          entry("GET", "https://drop.me/b", 200, "application/json", "{}"),
        ]),
        { includeHosts: ["keep.me"] },
      ),
    );
    expect(drafts.map((d) => d.rule.request.path)).toEqual(["/a"]);
  });

  it("notes when one endpoint returned different bodies", () => {
    const { unsupported } = ok(
      parseHar(
        har([
          entry("GET", "https://x/status", 200, "application/json", '{"up":true}'),
          entry("GET", "https://x/status", 200, "application/json", '{"up":false}'),
        ]),
      ),
    );
    expect(unsupported.some((u) => u.includes("different response bodies"))).toBe(true);
  });

  it("errors on a non-HAR document", () => {
    const r = parseHar('{"nope":1}');
    expect("error" in r && r.error).toMatch(/not a HAR/);
  });
});
