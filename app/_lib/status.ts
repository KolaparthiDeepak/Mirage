export function statusClass(status: number): string {
  if (status >= 200 && status < 300) return "mx-status--2";
  if (status >= 400 && status < 500) return "mx-status--4";
  if (status >= 500 && status < 600) return "mx-status--5";
  return "mx-status";
}

export function statusKind(status: number): "2" | "4" | "5" | "x" {
  if (status >= 200 && status < 300) return "2";
  if (status >= 400 && status < 500) return "4";
  if (status >= 500 && status < 600) return "5";
  return "x";
}
