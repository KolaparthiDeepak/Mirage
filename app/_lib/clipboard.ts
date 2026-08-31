// Single place that owns the "did the copy actually work?" question. Callers
// toast success/failure off the boolean instead of assuming success.
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (!navigator.clipboard) return false;
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
