import type { ReactNode } from "react";
import styles from "./ui.module.css";

type Props = { value: string; showLineNumbers?: boolean };
type Line = { depth: number; content: ReactNode };

function leaf(v: unknown): ReactNode {
  if (v === null) return <span className="j-null">null</span>;
  if (typeof v === "string")
    return <span className="j-str">{JSON.stringify(v)}</span>;
  if (typeof v === "number") return <span className="j-num">{String(v)}</span>;
  if (typeof v === "boolean") return <span className="j-bool">{String(v)}</span>;
  return <span>{String(v)}</span>;
}

function build(
  v: unknown,
  depth: number,
  comma: boolean,
  keyLabel: ReactNode | null,
): Line[] {
  const prefix = keyLabel ? <>{keyLabel}: </> : null;
  const tail = comma ? "," : "";

  if (v !== null && typeof v === "object") {
    const isArr = Array.isArray(v);
    const entries = isArr
      ? (v as unknown[]).map((item, i) => [String(i), item] as const)
      : Object.entries(v as Record<string, unknown>);
    const [open, close] = isArr ? ["[", "]"] : ["{", "}"];
    if (entries.length === 0)
      return [{ depth, content: <>{prefix}{open}{close}{tail}</> }];
    const out: Line[] = [{ depth, content: <>{prefix}{open}</> }];
    entries.forEach(([k, val], i) => {
      const last = i === entries.length - 1;
      const label = isArr ? null : (
        <span className="j-key">{JSON.stringify(k)}</span>
      );
      out.push(...build(val, depth + 1, !last, label));
    });
    out.push({ depth, content: <>{close}{tail}</> });
    return out;
  }

  return [{ depth, content: <>{prefix}{leaf(v)}{tail}</> }];
}

export function JsonView({ value, showLineNumbers }: Props) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return (
      <div className={styles.jsonWrap}>
        <pre data-invalid className={styles.jsonPre}>
          {value}
        </pre>
      </div>
    );
  }

  const rows = build(parsed, 0, false, null);

  return (
    <div className={styles.jsonWrap}>
      <pre className={styles.jsonPre}>
        {rows.map((row, i) => (
          <div key={i} className={styles.jsonLine}>
            {showLineNumbers ? (
              <span className={styles.jsonGutter}>{i + 1}</span>
            ) : null}
            <span style={{ paddingLeft: `${row.depth * 1.25}em` }}>
              {row.content}
            </span>
          </div>
        ))}
      </pre>
    </div>
  );
}
