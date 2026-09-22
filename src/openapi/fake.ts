// Plan 09 — deterministic JSON-Schema faker. Runs at compile/import time, not
// per request: the generated body is stored on the rule like any other body.
//
// Deterministic BY CONSTRUCTION: there is no RNG. Every rule below maps a
// schema to exactly one value, so the same schema yields a byte-identical
// body across builds, machines and processes. `example`/`examples` always
// win and are handled by the caller before this runs.
//
// Fake values are recognisably fake — "string", "user@example.com",
// TEST-NET IPs — so nobody mistakes a mock for real data.

export interface FakeSchema {
  type?: string | string[];
  format?: string;
  enum?: unknown[];
  default?: unknown;
  properties?: Record<string, FakeSchema>;
  required?: string[];
  items?: FakeSchema;
  minItems?: number;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  nullable?: boolean;
  oneOf?: FakeSchema[];
  anyOf?: FakeSchema[];
  allOf?: FakeSchema[];
}

const MAX_DEPTH = 5;

const FORMAT_VALUES: Record<string, string> = {
  uuid: "00000000-0000-4000-8000-000000000000",
  "date-time": "2020-01-01T00:00:00Z",
  date: "2020-01-01",
  time: "00:00:00",
  email: "user@example.com",
  uri: "https://example.com",
  url: "https://example.com",
  hostname: "example.com",
  ipv4: "192.0.2.1", // TEST-NET-1, guaranteed non-routable
  ipv6: "2001:db8::1", // documentation range
  byte: "ZmFrZQ==",
  binary: "",
  password: "password",
};

function clampString(base: string, schema: FakeSchema): string {
  let s = base;
  if (schema.minLength != null && s.length < schema.minLength) {
    s = s.padEnd(schema.minLength, "x");
  }
  if (schema.maxLength != null && s.length > schema.maxLength) {
    s = s.slice(0, schema.maxLength);
  }
  return s;
}

function pickType(schema: FakeSchema): string | undefined {
  if (Array.isArray(schema.type)) return schema.type.find((t) => t !== "null") ?? schema.type[0];
  return schema.type;
}

function mergeAllOf(parts: FakeSchema[]): FakeSchema {
  const merged: FakeSchema = { type: "object", properties: {}, required: [] };
  for (const p of parts) {
    if (p.properties) merged.properties = { ...merged.properties, ...p.properties };
    if (p.required) merged.required = [...(merged.required ?? []), ...p.required];
    if (p.type && p.type !== "object") merged.type = p.type;
  }
  return merged;
}

export interface FakeOptions {
  /** When true, optional object properties are emitted too. Default: required only. */
  full?: boolean;
}

export function fakeFromSchema(schema: FakeSchema | undefined, opts: FakeOptions = {}): unknown {
  return build(schema, opts, 0, new Set());
}

function build(
  schema: FakeSchema | undefined,
  opts: FakeOptions,
  depth: number,
  seen: Set<FakeSchema>,
): unknown {
  if (!schema || typeof schema !== "object") return null;
  if (depth > MAX_DEPTH || seen.has(schema)) return null; // cycle / depth guard
  seen = new Set(seen).add(schema);

  if ("default" in schema && schema.default !== undefined) return schema.default;
  if (schema.enum && schema.enum.length > 0) return schema.enum[0];
  if (schema.allOf && schema.allOf.length > 0) return build(mergeAllOf(schema.allOf), opts, depth, seen);
  if (schema.oneOf && schema.oneOf.length > 0) return build(schema.oneOf[0], opts, depth, seen);
  if (schema.anyOf && schema.anyOf.length > 0) return build(schema.anyOf[0], opts, depth, seen);

  const type = pickType(schema) ?? (schema.properties ? "object" : schema.items ? "array" : "string");

  switch (type) {
    case "string": {
      if (schema.format && FORMAT_VALUES[schema.format] != null) {
        return clampString(FORMAT_VALUES[schema.format]!, schema);
      }
      return clampString("string", schema);
    }
    case "integer": {
      if (schema.minimum != null) return schema.minimum;
      if (schema.maximum != null) return Math.min(0, schema.maximum);
      return 0;
    }
    case "number": {
      if (schema.minimum != null) return schema.minimum;
      if (schema.maximum != null) return Math.min(0, schema.maximum);
      return 0;
    }
    case "boolean":
      return true;
    case "array": {
      const count = Math.max(schema.minItems ?? 1, 0);
      const item = () => build(schema.items, opts, depth + 1, seen);
      return Array.from({ length: count }, item);
    }
    case "object": {
      const out: Record<string, unknown> = {};
      const props = schema.properties ?? {};
      const required = new Set(schema.required ?? []);
      for (const [key, sub] of Object.entries(props)) {
        if (required.has(key) || opts.full) {
          out[key] = build(sub, opts, depth + 1, seen);
        }
      }
      return out;
    }
    case "null":
      return null;
    default:
      return null;
  }
}
