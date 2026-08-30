import styles from "./ui.module.css";

type Tone = "neutral" | "success" | "warning" | "error" | "info";

function tone(method: string): Tone {
  switch (method.toUpperCase()) {
    case "GET":
      return "success";
    case "POST":
      return "info";
    case "PUT":
    case "PATCH":
      return "warning";
    case "DELETE":
      return "error";
    default:
      return "neutral";
  }
}

export function MethodPill({ method }: { method: string }) {
  return (
    <span data-tone={tone(method)} className={styles.method}>
      {method}
    </span>
  );
}
