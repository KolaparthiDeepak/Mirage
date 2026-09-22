// Plan 16 — JUnit XML, so a flow run is a CI job with no client library:
// `GET .../flows/:id/run?format=junit` returns this directly.
import type { StepResult } from "./run";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function toJUnitXml(flowName: string, steps: StepResult[]): string {
  // JUnit's failures/errors are mutually exclusive categories: a step that
  // threw is an error, not also a failure.
  const errors = steps.filter((s) => s.error).length;
  const failures = steps.filter((s) => !s.passed && !s.error).length;
  const totalMs = steps.reduce((sum, s) => sum + s.durationMs, 0);

  const cases = steps
    .map((s) => {
      const time = (s.durationMs / 1000).toFixed(3);
      if (s.error) {
        return `    <testcase name="${esc(s.name)}" time="${time}"><error message="${esc(s.error)}"/></testcase>`;
      }
      if (!s.passed) {
        const failed = s.assertions.filter((a) => !a.passed);
        const message = failed.map((a) => `${a.description} — expected ${JSON.stringify(a.expected)}, got ${JSON.stringify(a.actual)}`).join("; ");
        return `    <testcase name="${esc(s.name)}" time="${time}"><failure message="${esc(message)}"/></testcase>`;
      }
      return `    <testcase name="${esc(s.name)}" time="${time}"/>`;
    })
    .join("\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<testsuite name="${esc(flowName)}" tests="${steps.length}" failures="${failures}" errors="${errors}" time="${(totalMs / 1000).toFixed(3)}">`,
    cases,
    "</testsuite>",
    "",
  ].join("\n");
}
