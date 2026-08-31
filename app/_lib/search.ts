import { commandCode } from "./endpoint-label";
import type { ViewModel, ProjectVM, EndpointVM, CaseVM } from "@/src/viewer/model";

export interface SearchResults {
  projects: ProjectVM[];
  endpoints: { project: ProjectVM; endpoint: EndpointVM }[];
  cases: { project: ProjectVM; endpoint: EndpointVM; case: CaseVM }[];
}

export function searchViewModel(model: ViewModel, query: string): SearchResults {
  const trimmed = query.trim();

  if (trimmed === "") {
    return { projects: [], endpoints: [], cases: [] };
  }

  const q = trimmed.toLowerCase();
  const projects: ProjectVM[] = [];
  const endpoints: { project: ProjectVM; endpoint: EndpointVM }[] = [];
  const cases: { project: ProjectVM; endpoint: EndpointVM; case: CaseVM }[] = [];

  for (const project of model.projects) {
    // Search projects
    if (project.name.toLowerCase().includes(q) || project.slug.toLowerCase().includes(q)) {
      projects.push(project);
    }

    // Search endpoints and cases
    for (const endpoint of project.endpoints) {
      // Search endpoints
      const commandCodeMatch = commandCode(endpoint.path).toLowerCase().includes(q);
      const pathMatch = endpoint.path.toLowerCase().includes(q);
      const summaryMatch = endpoint.summary ? endpoint.summary.toLowerCase().includes(q) : false;
      const methodMatch = endpoint.method.toLowerCase().includes(q);

      if (commandCodeMatch || pathMatch || summaryMatch || methodMatch) {
        endpoints.push({ project, endpoint });
      }

      // Search cases
      for (const caseItem of endpoint.cases) {
        const labelMatch = caseItem.label.toLowerCase().includes(q);
        const idMatch = caseItem.id.toLowerCase().includes(q);

        if (labelMatch || idMatch) {
          cases.push({ project, endpoint, case: caseItem });
        }
      }
    }
  }

  // Cap each array at 8
  return {
    projects: projects.slice(0, 8),
    endpoints: endpoints.slice(0, 8),
    cases: cases.slice(0, 8),
  };
}
