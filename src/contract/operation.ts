// Plan 13 — find the operation in an OpenAPI doc that a rule (or a request)
// corresponds to, and pull its request / response schemas.

type Doc = { paths?: Record<string, Record<string, OperationObject>> };
interface OperationObject {
  parameters?: Array<{ name: string; in: string; required?: boolean; schema?: unknown }>;
  requestBody?: { content?: Record<string, { schema?: unknown }> };
  responses?: Record<string, { content?: Record<string, { schema?: unknown }> }>;
}

/** "/users/{id}" <-> "/users/:id" — compare structurally, param names ignored. */
function pathsMatch(oaPath: string, rulePath: string): boolean {
  const a = oaPath.split("/");
  const b = rulePath.split("/");
  if (a.length !== b.length) return false;
  return a.every((seg, i) => {
    const other = b[i]!;
    const aParam = /^\{.+\}$/.test(seg);
    const bParam = other.startsWith(":");
    if (aParam || bParam) return aParam && bParam;
    return seg === other;
  });
}

export interface OperationSchemas {
  oaPath: string;
  requestBodySchema?: unknown;
  responseSchema?: unknown;
  /** Query/path params that are `required` in the spec. */
  requiredParams: Array<{ name: string; in: string; schema?: unknown }>;
}

function jsonSchema(content: Record<string, { schema?: unknown }> | undefined): unknown {
  if (!content) return undefined;
  return (
    content["application/json"]?.schema ??
    Object.entries(content).find(([k]) => k.includes("json"))?.[1]?.schema ??
    Object.values(content)[0]?.schema
  );
}

function pickResponse(
  responses: Record<string, { content?: Record<string, { schema?: unknown }> }> | undefined,
  status: number,
): { content?: Record<string, { schema?: unknown }> } | undefined {
  if (!responses) return undefined;
  return (
    responses[String(status)] ??
    responses[`${Math.floor(status / 100)}XX`] ??
    responses.default ??
    responses[Object.keys(responses).find((k) => /^2\d\d$/.test(k)) ?? ""]
  );
}

export function operationSchemas(
  doc: unknown,
  method: string,
  rulePath: string,
  status: number,
): OperationSchemas | null {
  const paths = (doc as Doc)?.paths;
  if (!paths) return null;
  const m = method.toLowerCase();
  for (const [oaPath, ops] of Object.entries(paths)) {
    if (!pathsMatch(oaPath, rulePath)) continue;
    const op = ops[m];
    if (!op) continue;
    return {
      oaPath,
      requestBodySchema: jsonSchema(op.requestBody?.content),
      responseSchema: jsonSchema(pickResponse(op.responses, status)?.content),
      requiredParams: (op.parameters ?? [])
        .filter((p) => p.required && (p.in === "query" || p.in === "path"))
        .map((p) => ({ name: p.name, in: p.in, schema: p.schema })),
    };
  }
  return null;
}

/** Every (method, path) operation the doc declares — for coverage (13.3). */
export function listOperations(doc: unknown): Array<{ method: string; path: string }> {
  const paths = (doc as Doc)?.paths ?? {};
  const out: Array<{ method: string; path: string }> = [];
  for (const [oaPath, ops] of Object.entries(paths)) {
    for (const m of ["get", "post", "put", "patch", "delete"]) {
      if (ops[m]) out.push({ method: m.toUpperCase(), path: oaPath.replace(/\{([^}]+)\}/g, ":$1") });
    }
  }
  return out;
}
