// Plan 13 — the one place Ajv is loaded. Dynamically imported so the mock hot
// path never pulls it in when contract validation is off (design doc §8,
// condition on the approval). Compiled validators are cached by key.

import { normalizeSchema } from "../openapi/normalize";

export interface ContractViolation {
  /** JSON path into the value, e.g. "$.riskScore". */
  path: string;
  message: string;
}

type ValidateFn = ((data: unknown) => boolean) & {
  errors?: Array<{ instancePath?: string; message?: string; params?: Record<string, unknown> }> | null;
};

let ajvPromise: Promise<{ compile: (schema: object) => ValidateFn }> | undefined;

async function getAjv() {
  if (!ajvPromise) {
    ajvPromise = (async () => {
      const [{ default: Ajv }, { default: addFormats }] = await Promise.all([
        import("ajv"),
        import("ajv-formats"),
      ]);
      const ajv = new Ajv({ allErrors: true, strict: false, coerceTypes: false });
      addFormats(ajv);
      return ajv as unknown as { compile: (schema: object) => ValidateFn };
    })();
  }
  return ajvPromise;
}

const compiledCache = new Map<string, ValidateFn>();

function describe(err: { instancePath?: string; message?: string; params?: Record<string, unknown> }): ContractViolation {
  const path = "$" + (err.instancePath ?? "").replace(/\//g, ".");
  const t = err.params && typeof err.params.type === "string" ? err.params.type : undefined;
  const missing = err.params && typeof err.params.missingProperty === "string" ? err.params.missingProperty : undefined;
  let message = err.message ?? "invalid";
  if (missing) message = `missing required property "${missing}"`;
  else if (t) message = `expected ${t}`;
  return { path, message };
}

/** Validate `value` against `schema` (OpenAPI 3.0 or 3.1). Returns [] on
 *  success. `cacheKey` should identify the operation + schema-role so the
 *  compiled validator is reused across requests. */
export async function validateAgainstSchema(
  schema: unknown,
  value: unknown,
  cacheKey?: string,
): Promise<ContractViolation[]> {
  if (schema == null || typeof schema !== "object") return [];
  let validate = cacheKey ? compiledCache.get(cacheKey) : undefined;
  if (!validate) {
    const ajv = await getAjv();
    try {
      validate = ajv.compile(normalizeSchema(schema) as object);
    } catch (e) {
      return [{ path: "$", message: `schema could not be compiled: ${(e as Error).message}` }];
    }
    if (cacheKey) compiledCache.set(cacheKey, validate);
  }
  if (validate(value)) return [];
  return (validate.errors ?? []).map(describe);
}

/** Test hook. */
export function __clearContractCache(): void {
  compiledCache.clear();
}
