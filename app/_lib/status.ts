export function statusKind(status: number): "2" | "4" | "5" | "x" {
  if (status >= 200 && status < 300) return "2";
  if (status >= 400 && status < 500) return "4";
  if (status >= 500 && status < 600) return "5";
  return "x";
}
