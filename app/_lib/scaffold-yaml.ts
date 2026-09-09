/** Copy-paste YAML scaffolds for the creation modals. All pure — no backend write. */
import { yamlScalar } from "./yaml-scalar";

/** lowercase, non-alphanumerics -> "-", collapsed, trimmed. */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Normalise a user-typed JSON body to a one-line JSON string (valid YAML flow).
 *  `valid` is false when the input didn't parse — callers surface a warning and
 *  the body falls back to `{}`. */
export function jsonBodyOrEmpty(body: string): { text: string; valid: boolean } {
  try {
    return { text: JSON.stringify(JSON.parse(body)), valid: true };
  } catch {
    return { text: "{}", valid: false };
  }
}

/** A `mocks/<slug>/project.yaml` stub. */
export function newProjectYaml(input: { name: string; slug: string }): string {
  return (
    [
      `name: ${yamlScalar(input.name)}`,
      `slug: ${input.slug}`,
      // No `basePath:` — "/" is not a base path, and emitting it used to drop
      // every OpenAPI-generated route in the project.
      `defaults:`,
      `  delayMs: 0`,
      `  cors: true`,
    ].join("\n") + "\n"
  );
}

/** A `routes/*.yaml` list item for a new endpoint. Id includes the method so
 *  `GET /x` and `POST /x` don't collide on `x-ok`. */
export function newEndpointYaml(input: { method: string; path: string }): string {
  return (
    [
      `- id: ${input.method.toLowerCase()}-${slugify(input.path)}-ok`,
      `  request:`,
      `    method: ${input.method}`,
      `    path: ${yamlScalar(input.path)}`,
      `  response: { status: 200, body: {} }`,
    ].join("\n") + "\n"
  );
}

/** A `routes/*.yaml` list item for a new response case. */
export function newCaseYaml(input: {
  id: string;
  status: number;
  body: string;
  path: string;
  method: string;
}): string {
  return (
    [
      `- id: ${yamlScalar(input.id)}`,
      `  request:`,
      `    method: ${input.method}`,
      `    path: ${yamlScalar(input.path)}`,
      `  response: { status: ${input.status}, body: ${jsonBodyOrEmpty(input.body).text} }`,
    ].join("\n") + "\n"
  );
}
