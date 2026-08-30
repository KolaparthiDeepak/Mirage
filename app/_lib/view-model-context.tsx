"use client";
import React, { createContext, useContext, type ReactNode } from "react";
import type { ViewModel, ProjectVM } from "@/src/viewer/model";

const Ctx = createContext<ViewModel | null>(null);

export function ViewModelProvider({ model, children }: { model: ViewModel; children: ReactNode }) {
  return <Ctx.Provider value={model}>{children}</Ctx.Provider>;
}

export function useViewModel(): ViewModel {
  const v = useContext(Ctx);
  if (!v) throw new Error("useViewModel must be used inside <ViewModelProvider>");
  return v;
}

export function useProject(slug: string): ProjectVM | null {
  return useViewModel().projects.find((p) => p.slug === slug) ?? null;
}
