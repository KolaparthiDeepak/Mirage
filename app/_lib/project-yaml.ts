/** Minimal valid `mocks/<slug>/project.yaml`. Pure — copy-paste only. */
export function projectYaml(input: {
  name: string;
  slug: string;
  basePath?: string;
}): string {
  const name = /[:#]/.test(input.name) ? `"${input.name}"` : input.name;
  const lines = [`name: ${name}`, `slug: ${input.slug}`];
  if (input.basePath) lines.push(`basePath: ${input.basePath}`);
  lines.push("defaults:", "  delayMs: 0", "  cors: true");
  return lines.join("\n") + "\n";
}
