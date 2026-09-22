// Plan 03: "Export to YAML — a mocks/<slug>/ tree as a download, byte-
// compatible with the compiler." Uses the `yaml` package (already a
// dependency, the same one src/compile/compile.ts parses with) rather than
// hand-rolled string templates — round-tripping through the same library both
// directions is what makes "recompiles to an identical config" a property,
// not a hope.
//
// Returns a flat filename -> content map rather than a zip archive: a zip
// would need a new dependency for one export feature. Each file downloads
// individually from the UI; a real archive is a small, disclosed follow-up.
import { stringify } from "yaml";
import type { StoredProject } from "./types";

export type ExportedFiles = Record<string, string>;

export function exportProjectToYaml(project: StoredProject): ExportedFiles {
  const projectYaml: Record<string, unknown> = { name: project.name, slug: project.slug };
  if (project.basePath) projectYaml.basePath = project.basePath;
  projectYaml.defaults = project.defaults;

  const rules = [...project.rules]
    .sort((a, b) => a.position - b.position)
    .map((r) => r.definition);

  return {
    "project.yaml": stringify(projectYaml),
    "routes/main.yaml": stringify(rules),
  };
}
