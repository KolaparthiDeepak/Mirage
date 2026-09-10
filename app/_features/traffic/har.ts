// Plan 05 export: a HAR 1.2 log built from recorded traffic. Round-trips with
// plan 08's future HAR importer — export from one project, import into
// another. Deliberately minimal: only the fields HAR 1.2 requires plus the
// handful every consumer actually reads (status, headers, content, timings).
import type { TrafficEntry } from "@/src/store/types";

function toHarHeaders(headers: Record<string, string>): { name: string; value: string }[] {
  return Object.entries(headers).map(([name, value]) => ({ name, value }));
}

export function buildHar(entries: TrafficEntry[]): object {
  return {
    log: {
      version: "1.2",
      creator: { name: "Mirage", version: "0.1.0" },
      entries: entries.map((e) => ({
        startedDateTime: e.at,
        time: e.durationMs,
        request: {
          method: e.method,
          url: `${e.slug}${e.path}`,
          httpVersion: "HTTP/1.1",
          headers: toHarHeaders(e.reqHeaders),
          queryString: Object.entries(e.query).map(([name, value]) => ({ name, value })),
          postData: e.reqBody != null ? { mimeType: e.reqHeaders["content-type"] ?? "application/json", text: e.reqBody } : undefined,
          headersSize: -1,
          bodySize: e.reqBody?.length ?? 0,
        },
        response: {
          status: e.status,
          statusText: "",
          httpVersion: "HTTP/1.1",
          headers: toHarHeaders(e.resHeaders),
          content: {
            size: e.resBody?.length ?? 0,
            mimeType: e.resHeaders["content-type"] ?? "application/json",
            text: e.resBody ?? "",
          },
          redirectURL: "",
          headersSize: -1,
          bodySize: e.resBody?.length ?? 0,
        },
        cache: {},
        timings: { send: 0, wait: e.durationMs, receive: 0 },
      })),
    },
  };
}
