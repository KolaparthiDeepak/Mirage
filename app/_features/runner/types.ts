export interface RunResult {
  status: number;
  ms: number;
  headers: [string, string][];
  bodyText: string;
  verdict: import("@/src/viewer/verdict").Verdict;
}
