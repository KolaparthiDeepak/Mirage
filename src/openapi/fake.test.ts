import { describe, it, expect } from "vitest";
import { fakeFromSchema, type FakeSchema } from "./fake";

describe("fakeFromSchema", () => {
  it("prefers default, then enum", () => {
    expect(fakeFromSchema({ type: "string", default: "d", enum: ["a", "b"] })).toBe("d");
    expect(fakeFromSchema({ type: "string", enum: ["first", "second"] })).toBe("first");
  });

  it("produces a recognisably-fake value for each format", () => {
    const f = (format: string) => fakeFromSchema({ type: "string", format });
    expect(f("uuid")).toBe("00000000-0000-4000-8000-000000000000");
    expect(f("email")).toBe("user@example.com");
    expect(f("date-time")).toBe("2020-01-01T00:00:00Z");
    expect(f("date")).toBe("2020-01-01");
    expect(f("uri")).toBe("https://example.com");
    expect(f("ipv4")).toBe("192.0.2.1");
  });

  it("is byte-identical across repeated calls", () => {
    const schema: FakeSchema = {
      type: "object",
      required: ["id", "tags", "meta"],
      properties: {
        id: { type: "string", format: "uuid" },
        tags: { type: "array", minItems: 2, items: { type: "string" } },
        meta: { type: "object", required: ["n"], properties: { n: { type: "integer", minimum: 3 } } },
      },
    };
    expect(JSON.stringify(fakeFromSchema(schema))).toBe(JSON.stringify(fakeFromSchema(schema)));
  });

  it("emits required properties always, optionals only in full mode", () => {
    const schema: FakeSchema = {
      type: "object",
      required: ["a"],
      properties: { a: { type: "string" }, b: { type: "string" } },
    };
    expect(fakeFromSchema(schema)).toEqual({ a: "string" });
    expect(fakeFromSchema(schema, { full: true })).toEqual({ a: "string", b: "string" });
  });

  it("respects minItems, minimum, maxLength", () => {
    expect(fakeFromSchema({ type: "array", minItems: 3, items: { type: "boolean" } })).toEqual([true, true, true]);
    expect(fakeFromSchema({ type: "integer", minimum: 42 })).toBe(42);
    expect(fakeFromSchema({ type: "string", maxLength: 3 })).toBe("str");
    expect((fakeFromSchema({ type: "string", minLength: 8 }) as string).length).toBe(8);
  });

  it("terminates on a self-referential schema at the depth cap", () => {
    const node: FakeSchema = { type: "object", required: ["child"], properties: {} };
    node.properties!.child = node; // cycle
    const out = fakeFromSchema(node);
    expect(out).toBeDefined(); // did not hang
    expect(JSON.stringify(out).length).toBeLessThan(200);
  });

  it("takes the first branch of oneOf/anyOf and merges allOf", () => {
    expect(fakeFromSchema({ oneOf: [{ type: "boolean" }, { type: "string" }] })).toBe(true);
    expect(
      fakeFromSchema({
        allOf: [
          { type: "object", required: ["a"], properties: { a: { type: "string" } } },
          { type: "object", required: ["b"], properties: { b: { type: "integer", minimum: 1 } } },
        ],
      }),
    ).toEqual({ a: "string", b: 1 });
  });
});
