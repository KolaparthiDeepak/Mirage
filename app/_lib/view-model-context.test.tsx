import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ViewModelProvider, useViewModel, useProject } from "./view-model-context";
import type { ViewModel } from "@/src/viewer/model";

const model: ViewModel = {
  build: { commit: "abc", builtAt: "2026-08-30", warnings: [] },
  projects: [{ slug: "card-block-lost", name: "Card Block", endpoints: [], caseCount: 0 }],
};

function Probe({ slug }: { slug: string }) {
  const vm = useViewModel();
  const p = useProject(slug);
  return <div>{vm.projects.length}:{p?.name ?? "none"}</div>;
}

describe("view-model-context", () => {
  it("provides the model and resolves a project by slug", () => {
    render(<ViewModelProvider model={model}><Probe slug="card-block-lost" /></ViewModelProvider>);
    expect(screen.getByText("1:Card Block")).toBeDefined();
  });
  it("returns null for an unknown slug", () => {
    render(<ViewModelProvider model={model}><Probe slug="nope" /></ViewModelProvider>);
    expect(screen.getByText("1:none")).toBeDefined();
  });
});
