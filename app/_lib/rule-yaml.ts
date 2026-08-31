import { yamlScalar } from "./yaml-scalar";

export interface RuleCondition {
  field: string;
  op: string;
  value: string;
}

/** `field` is a builder path like `body.x`, `header.X`, `query.X`, or a bare
 *  key. Anything outside these shapes can inject arbitrary YAML into the flow
 *  mapping, so it's rejected. */
const FIELD_RE = /^(?:(?:body|header|query)\.[\w.$-]+|[\w.$-]+)$/;

function isValidField(field: string): boolean {
  return FIELD_RE.test(field);
}

/** Map a builder `field` to a YAML match target.
 *  `body.x` -> `jsonPath: $.x`; `header.X` -> `header: X`; `query.X` -> `query: X`;
 *  anything without a dot -> `jsonPath: $.<field>`. */
function target(field: string): string {
  const dot = field.indexOf(".");
  if (dot === -1) return `jsonPath: $.${field}`;
  const head = field.slice(0, dot);
  const rest = field.slice(dot + 1);
  if (head === "header") return `header: ${rest}`;
  if (head === "query") return `query: ${rest}`;
  if (head === "body") return `jsonPath: $.${rest}`;
  return `jsonPath: $.${field}`;
}

function operator(op: string, value: string): string {
  return op === "exists" ? "exists: true" : `${op}: ${yamlScalar(value)}`;
}

/** A `routes/*.yaml` list-item block for one response-selection rule. Pure. */
export function ruleYaml(
  conditions: RuleCondition[],
  caseId: string,
  method: string,
  path: string,
): string {
  const lines = [
    `- id: ${caseId}`,
    `  request:`,
    `    method: ${method}`,
    `    path: ${path}`,
  ];

  const valid = conditions.filter((c) => isValidField(c.field));
  const skipped = conditions.filter((c) => !isValidField(c.field));

  if (skipped.length > 0) {
    lines.push(
      `    # invalid field — condition(s) skipped: ${skipped
        .map((c) => JSON.stringify(c.field))
        .join(", ")}`,
    );
  }
  if (valid.length > 0) {
    const match = valid
      .map((c) => `{ ${target(c.field)}, ${operator(c.op, c.value)} }`)
      .join(", ");
    lines.push(`    match: [${match}]`);
  }
  lines.push(`  response: { status: 200, body: {} }`);
  return lines.join("\n") + "\n";
}
