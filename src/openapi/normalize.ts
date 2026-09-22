// Plan 13 — normalise OpenAPI 3.0 schema semantics to the 3.1 / JSON Schema
// dialect Ajv expects, once, so the validator never has to care which version
// the spec was written in.
//
// 3.0 differences handled: `nullable: true` -> `"null"` in the type;
// `exclusiveMinimum`/`exclusiveMaximum` as booleans -> numbers.

const CHILD_OBJECT_KEYS = ["items", "additionalProperties", "not", "if", "then", "else", "contains", "propertyNames"];
const CHILD_MAP_KEYS = ["properties", "patternProperties", "$defs", "definitions"];
const CHILD_ARRAY_KEYS = ["allOf", "anyOf", "oneOf", "prefixItems"];

export function normalizeSchema(input: unknown): unknown {
  if (Array.isArray(input)) return input.map(normalizeSchema);
  if (!input || typeof input !== "object") return input;

  const s: Record<string, unknown> = { ...(input as Record<string, unknown>) };

  if (s.nullable === true) {
    delete s.nullable;
    if (typeof s.type === "string") s.type = [s.type, "null"];
    else if (Array.isArray(s.type) && !s.type.includes("null")) s.type = [...s.type, "null"];
  } else if (s.nullable === false) {
    delete s.nullable;
  }

  if (s.exclusiveMinimum === true && typeof s.minimum === "number") {
    s.exclusiveMinimum = s.minimum;
    delete s.minimum;
  } else if (s.exclusiveMinimum === false) {
    delete s.exclusiveMinimum;
  }
  if (s.exclusiveMaximum === true && typeof s.maximum === "number") {
    s.exclusiveMaximum = s.maximum;
    delete s.maximum;
  } else if (s.exclusiveMaximum === false) {
    delete s.exclusiveMaximum;
  }

  for (const k of CHILD_OBJECT_KEYS) {
    if (s[k] && typeof s[k] === "object") s[k] = normalizeSchema(s[k]);
  }
  for (const k of CHILD_MAP_KEYS) {
    if (s[k] && typeof s[k] === "object" && !Array.isArray(s[k])) {
      s[k] = Object.fromEntries(
        Object.entries(s[k] as Record<string, unknown>).map(([kk, v]) => [kk, normalizeSchema(v)]),
      );
    }
  }
  for (const k of CHILD_ARRAY_KEYS) {
    if (Array.isArray(s[k])) s[k] = (s[k] as unknown[]).map(normalizeSchema);
  }

  return s;
}
