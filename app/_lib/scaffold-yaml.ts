/** Copy-paste YAML scaffolds for the creation modals. All pure — no backend write. */

/** lowercase, non-alphanumerics -> "-", collapsed, trimmed. */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** A `mocks/<slug>/project.yaml` stub. */
export function newProjectYaml(input: { name: string; slug: string }): string {
  return (
    [
      `name: ${input.name}`,
      `slug: ${input.slug}`,
      `basePath: /`,
      `defaults:`,
      `  delayMs: 0`,
      `  cors: true`,
    ].join("\n") + "\n"
  );
}

/** A `routes/*.yaml` list item for a new endpoint. */
export function newEndpointYaml(input: { method: string; path: string }): string {
  return (
    [
      `- id: ${slugify(input.path)}-ok`,
      `  request:`,
      `    method: ${input.method}`,
      `    path: ${input.path}`,
      `  response: { status: 200, body: {} }`,
    ].join("\n") + "\n"
  );
}

/** A `routes/*.yaml` list item for a new response case. `body` is embedded as-is. */
export function newCaseYaml(input: {
  id: string;
  status: number;
  body: string;
  path: string;
  method: string;
}): string {
  return (
    [
      `- id: ${input.id}`,
      `  request:`,
      `    method: ${input.method}`,
      `    path: ${input.path}`,
      `  response: { status: ${input.status}, body: ${input.body} }`,
    ].join("\n") + "\n"
  );
}
