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
  "10:30:55",
  "10:29:11",
  "10:28:37",
  "10:27:02",
  "10:25:44",
  "10:24:19",
  "10:23:05",
  "10:21:52",
  "10:20:38",
  "10:18:47",
  "10:17:23",
  "10:15:09",
  "10:13:41",
  "10:11:58",
  "10:09:32",
  "10:07:16",
  "10:04:03",
  "10:01:29",
];

const MS = [8, 12, 18, 24, 31, 42, 9, 15];

const MAX = 30;

/** Deterministic sample request log derived from a project's real endpoints/cases.
 *  Preview-only data — the mock backend does not record traffic. */
export function sampleTraffic(project: ProjectVM): TrafficEntry[] {
  const out: TrafficEntry[] = [];
  for (const endpoint of project.endpoints) {
    if (out.length >= MAX) break;
    const cases = endpoint.cases ?? [];
    const perEndpoint = cases.length > 1 ? 2 : 1;
    for (let i = 0; i < perEndpoint && out.length < MAX; i++) {
      const c = cases.length > 0 ? cases[i % cases.length] : undefined;
      const status = c?.expected.status ?? 200;
      const idx = out.length;
      out.push({
        id: `${endpoint.key}-${i}`,
        method: endpoint.method,
        endpointKey: endpoint.key,
        path: endpoint.path,
        status,
        at: AT[idx % AT.length]!,
        ms: MS[idx % MS.length]!,
        reqHeaders: { "content-type": "application/json" },
        reqBody: endpoint.cases[i]?.request?.body ?? "{}",
        resBody: JSON.stringify(c?.expected.body ?? {}),
      });
    }
  }
  return out;
}
