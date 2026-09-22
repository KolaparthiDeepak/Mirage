import SwaggerParser from "@apidevtools/swagger-parser";
import { compileSegments } from "../engine/match";
import type { HttpMethod, Route } from "../engine/types";
import { fakeFromSchema, type FakeSchema } from "./fake";

export interface ExpandResult {
  routes: Route[];
  warnings: string[];
  mergedDoc: unknown;
}

export interface ExpandOptions {
  /** Plan 09: fill a response that has no example from its schema. */
  fakeFromSchema?: boolean;
}

const METHODS: HttpMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE"];

function chosenStatus(responses: Record<string, unknown>): string | undefined {
  const keys = Object.keys(responses).filter((k) => /^\d{3}$/.test(k)).sort();
  return keys.find((k) => k.startsWith("2")) ?? keys[0];
}

function exampleBody(responseObj: Record<string, unknown>): {
  body: unknown;
  hasExample: boolean;
  schema?: FakeSchema;
} {
  const content = (responseObj.content ?? {}) as Record<
    string,
    { example?: unknown; examples?: Record<string, { value?: unknown }>; schema?: FakeSchema }
  >;
  let schema: FakeSchema | undefined;
  for (const media of Object.values(content)) {
    if (media.examples) {
      const first = Object.values(media.examples)[0];
      if (first && "value" in first) return { body: first.value ?? null, hasExample: true };
    }
    if ("example" in media && media.example != null) return { body: media.example, hasExample: true };
    if (!schema && media.schema) schema = media.schema;
  }
  return { body: null, hasExample: false, schema };
}

export async function expandOpenApi(filePath: string, opts: ExpandOptions = {}): Promise<ExpandResult> {
  const doc = (await SwaggerParser.validate(filePath)) as {
    paths?: Record<string, Record<string, { operationId?: string; responses?: Record<string, unknown> }>>;
  };
  const routes: Route[] = [];
  const warnings: string[] = [];

  for (const [oaPath, ops] of Object.entries(doc.paths ?? {})) {
    const path = oaPath.replace(/\{([^}]+)\}/g, ":$1");
    for (const method of METHODS) {
      const op = ops[method.toLowerCase()];
      if (!op) continue;
      const id = `openapi:${op.operationId ?? `${method} ${path}`}`;
      const responses = (op.responses ?? {}) as Record<string, Record<string, unknown>>;
      const statusKey = chosenStatus(responses);
      if (!statusKey) {
        warnings.push(`operation ${id}: no response declared — skipped`);
        continue;
      }
      const { body, hasExample, schema } = exampleBody(responses[statusKey]!);
      let finalBody = body;
      if (!hasExample) {
        if (opts.fakeFromSchema && schema) {
          finalBody = fakeFromSchema(schema);
          warnings.push(`operation ${id}: no example — response body generated from schema`);
        } else {
          warnings.push(`operation ${id}: no example — response body is empty`);
        }
      }
      routes.push({
        id,
        method,
        path,
        segments: compileSegments(path),
        response: { status: Number(statusKey), body: finalBody },
      });
    }
  }

  return { routes, warnings, mergedDoc: doc };
}
