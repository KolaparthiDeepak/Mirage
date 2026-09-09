// app/_lib/preview-store.tsx
"use client";
import React, { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

export interface Env { id: string; name: string; baseUrl: string }
export interface Variable { id: string; key: string; value: string; scope: "Global" | "Project" | "QA" | "Local" }
export interface ScenarioStep { id: string; endpointKey: string; expectedStatus: number }
export interface Scenario { id: string; name: string; steps: ScenarioStep[] }
export interface DraftRule { id: string; field: string; op: string; value: string; caseId: string }

export interface PreviewState {
  environments: Env[];
  activeEnvId: string;
  variables: Variable[];
  scenarios: Record<string, Scenario[]>;
  rulesDraft: Record<string, DraftRule[]>;
}

// Seed only Local — the other hosts don't exist, and Execute would POST the
// user's typed headers there. Users add real environments via the (validated)
// "Add environment" modal.
export const SEED_ENVIRONMENTS: Env[] = [{ id: "local", name: "Local", baseUrl: "" }];

// Per-tab and disposable (plan 17 replaces this store), so unlike theme.ts this
// needs no legacy-key fallback for the mockservers -> Mirage rename (plan 25).
const KEY = "mirage-preview";

function initial(): PreviewState {
  return { environments: SEED_ENVIRONMENTS, activeEnvId: "local", variables: [], scenarios: {}, rulesDraft: {} };
}

function load(): PreviewState {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return initial();
    const parsed = JSON.parse(raw) as Partial<PreviewState>;
    const merged = { ...initial(), ...parsed };
    if (!Array.isArray(merged.environments) || merged.environments.length === 0) {
      merged.environments = SEED_ENVIRONMENTS;
    }
    if (!merged.environments.some((e) => e.id === merged.activeEnvId)) {
      merged.activeEnvId = merged.environments[0]!.id;
    }
    return merged;
  } catch {
    return initial();
  }
}

interface Api { state: PreviewState; set: (updater: (s: PreviewState) => PreviewState) => void; activeEnv: Env }
const Ctx = createContext<Api | null>(null);

export function PreviewProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PreviewState>(initial);
  const hydrated = useRef(false);

  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    setState(load());
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    try { sessionStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode / jsdom */ }
  }, [state]);

  const set = useCallback((updater: (s: PreviewState) => PreviewState) => setState(updater), []);
  const activeEnv = state.environments.find((e) => e.id === state.activeEnvId) ?? state.environments[0]!; // environments is always seeded (>=1)

  return <Ctx.Provider value={{ state, set, activeEnv }}>{children}</Ctx.Provider>;
}

export function usePreview(): Api {
  const v = useContext(Ctx);
  if (!v) throw new Error("usePreview must be used inside <PreviewProvider>");
  return v;
}
