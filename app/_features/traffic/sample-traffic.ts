import type { ProjectVM } from "@/src/viewer/model";

export interface TrafficEntry {
  id: string;
  method: string;
  endpointKey: string;
  path: string;
  status: number;
  at: string;
  ms: number;
  reqHeaders: Record<string, string>;
  reqBody: string;
  resBody: string;
}

// Hardcoded, decrementing wall-clock strings — no Date/Date.now/Math.random anywhere here.
const AT = [
  "10:42:31",
  "10:41:58",
  "10:41:04",
  "10:40:12",
  "10:39:47",
  "10:38:55",
  "10:37:30",
  "10:36:12",
  "10:35:48",
  "10:34:19",
  "10:33:02",
  "10:31:40",
];

const MAX = 12;

/** Deterministic sample request log derived from a project's real endpoints/cases.
 *  Preview-only data — the mock backend does not record traffic. */
export function sampleTraffic(project: ProjectVM): TrafficEntry[] {
  const out: TrafficEntry[] = [];
  for (const endpoint of project.endpoints) {
    if (out.length >= MAX) break;
    const cases = endpoint.cases ?? [];
    const perEndpoint = cases.length > 1 ? 2 : 1;
    for (let i = 0; i < perEndpoint && out.length < MAX; i++) {
      const c = cases[i % cases.length]; // undefined when the endpoint has no cases
      const status = c?.expected.status ?? 200;
      const body = JSON.stringify(c?.expected.body ?? {});
      const idx = out.length;
      out.push({
        id: `${endpoint.key}-${i}`,
        method: endpoint.method,
        endpointKey: endpoint.key,
        path: endpoint.path,
        status,
        at: AT[idx % AT.length]!,
        ms: 8 + (idx % 6) * 5,
        reqHeaders: c?.request.headers ?? {},
        reqBody: body,
        resBody: body,
      });
    }
  }
  return out;
}
