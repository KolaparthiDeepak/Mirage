"use client";
import { createContext, useContext, type ReactNode } from "react";

export interface ProjectConfigLite {
  name: string;
  basePath?: string;
  defaults: { delayMs: number; cors: boolean };
  hasOpenApi: boolean;
}

const Ctx = createContext<Record<string, ProjectConfigLite> | null>(null);

export function ProjectConfigProvider({
  configs,
  children,
}: {
  configs: Record<string, ProjectConfigLite>;
  children: ReactNode;
}) {
  return <Ctx.Provider value={configs}>{children}</Ctx.Provider>;
}

export function useProjectConfig(slug: string): ProjectConfigLite | null {
  const configs = useContext(Ctx);
  if (!configs) throw new Error("useProjectConfig must be used inside <ProjectConfigProvider>");
  return configs[slug] ?? null;
}
