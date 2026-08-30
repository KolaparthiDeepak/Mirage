import type { ReactNode } from "react";
import bundleJson from "@/mocks.generated.json";
import type { CompiledBundle } from "@/src/compile/compile";
import { buildViewModel } from "@/src/viewer/model";
import { ViewModelProvider } from "@/app/_lib/view-model-context";
import { PreviewProvider } from "@/app/_lib/preview-store";
import { ToastProvider } from "@/app/_ui";
import { AppShell } from "@/app/_shell/AppShell";

export default function AppLayout({ children }: { children: ReactNode }) {
  const model = buildViewModel(bundleJson as unknown as CompiledBundle);
  return (
    <ViewModelProvider model={model}>
      <PreviewProvider>
        <ToastProvider>
          <AppShell>{children}</AppShell>
        </ToastProvider>
      </PreviewProvider>
    </ViewModelProvider>
  );
}
