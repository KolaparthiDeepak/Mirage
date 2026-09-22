// Plan 13.2 — validate an incoming request against the spec. Never changes the
// response; the caller records violations on the traffic row (or returns 400
// when contract.rejectInvalid is on).
import { operationSchemas } from "./operation";
import { validateAgainstSchema, type ContractViolation } from "./validate";

export async function checkRequestAgainstSpec(
  openApiDoc: unknown,
  method: string,
  /** basePath-stripped path, ":param" form. */
  path: string,
  status: number,
  body: unknown,
  query: Record<string, string>,
): Promise<ContractViolation[]> {
  if (!openApiDoc) return [];
  const op = operationSchemas(openApiDoc, method, path, status);
  if (!op) return [];

  const violations: ContractViolation[] = [];

  if (op.requestBodySchema && body !== undefined) {
    for (const v of await validateAgainstSchema(op.requestBodySchema, body, `${method} ${op.oaPath} req`)) {
      violations.push({ path: `request.body${v.path.slice(1)}`, message: v.message });
    }
  }

  for (const p of op.requiredParams) {
    if (p.in === "query" && !(p.name in query)) {
      violations.push({ path: `request.query.${p.name}`, message: "required query parameter is missing" });
    }
  }

  return violations;
}
