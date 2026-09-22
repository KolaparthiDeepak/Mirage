// Plan 18 — the docs portal is deliberately outside app/(app)/, so it never
// inherits the sidebar or command palette (a reading page, not a tool) and a
// docs link can never become an editor link by URL manipulation. It still
// needs ToastProvider for the page's CopyButtons.
import type { ReactNode } from "react";
import { ToastProvider } from "@/app/_ui";

export default function DocsLayout({ children }: { children: ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}
