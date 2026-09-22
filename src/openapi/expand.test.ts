import { describe, expect, it } from "vitest";
import { resolve } from "node:path";
import { expandOpenApi } from "./expand";

const fx = (n: string) => resolve(__dirname, "__fixtures__", n);

describe("expandOpenApi", () => {
  it("generates routes from examples and maps {param} -> :param", async () => {
    const r = await expandOpenApi(fx("with-examples.yaml"));
    expect(r.warnings).toEqual([]);
    const get = r.routes.find((x) => x.id === "openapi:getUser")!;
    expect(get.method).toBe("GET");
    expect(get.path).toBe("/users/:id");
    expect(get.response).toEqual({ status: 200, body: { id: "u1", name: "Ada" } });
    const post = r.routes.find((x) => x.id === "openapi:POST /ping")!;
    expect(post.response).toEqual({ status: 201, body: { pong: true } });
  });
  it("emits a warning and a null body when an operation has no example", async () => {
    const r = await expandOpenApi(fx("no-examples.yaml"));
    expect(r.routes[0]!.response).toEqual({ status: 200, body: null });
    expect(r.warnings.join("\n")).toMatch(/no example/i);
  });

  it("fills a schema-only response from the schema when fakeFromSchema is on (plan 09)", async () => {
    const r = await expandOpenApi(fx("schema-only.yaml"), { fakeFromSchema: true });
    expect(r.routes[0]!.response).toEqual({
      status: 200,
      body: { id: "00000000-0000-4000-8000-000000000000", kind: "alpha", count: 1 },
    });
    expect(r.warnings.join("\n")).toMatch(/generated from schema/);
    // determinism across a second parse
    const r2 = await expandOpenApi(fx("schema-only.yaml"), { fakeFromSchema: true });
    expect(JSON.stringify(r2.routes[0]!.response)).toBe(JSON.stringify(r.routes[0]!.response));
  });

  it("leaves the body empty when fakeFromSchema is off", async () => {
    const r = await expandOpenApi(fx("schema-only.yaml"));
    expect(r.routes[0]!.response.body).toBeNull();
  });
  it("treats an explicit `example: null` as no example", async () => {
    const r = await expandOpenApi(fx("null-example.yaml"));
    expect(r.routes[0]!.response).toEqual({ status: 200, body: null });
    expect(r.warnings.join("\n")).toMatch(/no example/i);
  });
});
