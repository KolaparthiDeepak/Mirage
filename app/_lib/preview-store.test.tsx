// app/_lib/preview-store.test.tsx
import React from "react";
import { render, screen, act, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, it, expect } from "vitest";
import { PreviewProvider, usePreview, SEED_ENVIRONMENTS } from "./preview-store";

function Probe() {
  const { state, set, activeEnv } = usePreview();
  return (
    <div>
      <span data-testid="count">{state.environments.length}</span>
      <span data-testid="active">{activeEnv.name}</span>
      <button onClick={() => set((s) => ({ ...s, variables: [...s.variables, { id: "1", key: "K", value: "V", scope: "Global" }] }))}>add</button>
      <span data-testid="vars">{state.variables.length}</span>
    </div>
  );
}

beforeEach(() => { try { sessionStorage.clear(); } catch { /* jsdom */ } });
afterEach(() => cleanup());

describe("preview-store", () => {
  it("seeds environments and renders with empty storage", () => {
    render(<PreviewProvider><Probe /></PreviewProvider>);
    expect(screen.getByTestId("count").textContent).toBe(String(SEED_ENVIRONMENTS.length));
    expect(screen.getByTestId("active").textContent).toBe("Local");
  });
  it("persists a change to sessionStorage", () => {
    render(<PreviewProvider><Probe /></PreviewProvider>);
    act(() => { screen.getByText("add").click(); });
    expect(screen.getByTestId("vars").textContent).toBe("1");
    const raw = sessionStorage.getItem("mockservers-preview");
    expect(raw && JSON.parse(raw).variables.length).toBe(1);
  });
  it("rehydrates from existing storage", () => {
    sessionStorage.setItem("mockservers-preview", JSON.stringify({
      environments: SEED_ENVIRONMENTS, activeEnvId: SEED_ENVIRONMENTS[0]!.id,
      variables: [{ id: "x", key: "A", value: "B", scope: "Global" }], scenarios: {}, rulesDraft: {},
    }));
    render(<PreviewProvider><Probe /></PreviewProvider>);
    expect(screen.getByTestId("vars").textContent).toBe("1");
  });
});
