/** Quote/escape an arbitrary string as a YAML double-quoted scalar.
 *  Always returns a `"..."`-wrapped string — valid YAML for any input,
 *  so callers never have to enumerate special characters. */
export function yamlScalar(v: string): string {
  let out = "";
  for (const ch of v) {
    const code = ch.codePointAt(0)!;
    if (ch === "\\") out += "\\\\";
    else if (ch === '"') out += '\\"';
    else if (ch === "\n") out += "\\n";
    else if (ch === "\t") out += "\\t";
    else if (code < 0x20 || code === 0x7f) {
      out += "\\x" + code.toString(16).padStart(2, "0");
    } else out += ch;
  }
  return `"${out}"`;
}
