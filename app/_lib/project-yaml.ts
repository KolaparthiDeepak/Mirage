import { yamlScalar } from "./yaml-scalar";

/** The subset of `mocks/<slug>/project.yaml` that GeneralTab can edit.
 *  Emits ONLY those keys — no `defaults:` block — so pasting these lines over
 *  the matching keys never clobbers `defaults.notFound` or other config the
 *  form doesn't touch. Pure — copy-paste only. */
export function projectYaml(input: {
  name: string;
  slug: string;
  basePath?: string;
}): string {
  const lines = [
    `name: ${yamlScalar(input.name)}`,
    `slug: ${yamlScalar(input.slug)}`,
  ];
  if (input.basePath) lines.push(`basePath: ${yamlScalar(input.basePath)}`);
  return lines.join("\n") + "\n";
}
