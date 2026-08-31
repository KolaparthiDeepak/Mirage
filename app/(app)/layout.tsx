import type { ReactNode } from "react";
import bundleJson from "@/mocks.generated.json";
import type { CompiledBundle } from "@/src/compile/compile";
import { buildViewModel } from "@/src/viewer/model";
import { ViewModelProvider } from "@/app/_lib/view-model-context";
import {
  ProjectConfigProvider,
  type ProjectConfigLite,
} from "@/app/_lib/project-config-context";
import { PreviewProvider } from "@/app/_lib/preview-store";
import { ToastProvider } from "@/app/_ui";
import { AppShell } from "@/app/_shell/AppShell";
import { IntroSplash } from "@/app/_shell/IntroSplash";

export default function AppLayout({ children }: { children: ReactNode }) {
  const bundle = bundleJson as unknown as CompiledBundle;
  const model = buildViewModel(bundle);
  const configs: Record<string, ProjectConfigLite> = Object.fromEntries(
    Object.entries(bundle.projects).map(([slug, p]) => [
      slug,
      {
        name: p.name,
        basePath: p.basePath,
        defaults: { delayMs: p.defaults.delayMs, cors: p.defaults.cors },
        hasOpenApi: p.openApiDoc != null,
      },
    ]),
  );
  return (
    <ViewModelProvider model={model}>
      <IntroSplash />
      <ProjectConfigProvider configs={configs}>
        <PreviewProvider>
          <ToastProvider>
            <AppShell>{children}</AppShell>
          </ToastProvider>
        </PreviewProvider>
      </ProjectConfigProvider>
    </ViewModelProvider>
  );
}
