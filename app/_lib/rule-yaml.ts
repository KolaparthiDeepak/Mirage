export interface RuleCondition {
  field: string;
  op: string;
  value: string;
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
  return op === "exists" ? "exists: true" : `${op}: "${value}"`;
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
  if (conditions.length > 0) {
    const match = conditions
      .map((c) => `{ ${target(c.field)}, ${operator(c.op, c.value)} }`)
      .join(", ");
    lines.push(`    match: [${match}]`);
  }
  lines.push(`  response: { status: 200, body: {} }`);
  return lines.join("\n") + "\n";
}
