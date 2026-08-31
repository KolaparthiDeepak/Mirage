import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import { afterEach, describe, it, expect } from "vitest";
import { PreviewProvider } from "@/app/_lib/preview-store";
import { EnvironmentList } from "./EnvironmentList";

afterEach(() => {
  cleanup();
  sessionStorage.clear();
});

function renderList() {
  return render(
    <PreviewProvider>
      <EnvironmentList />
    </PreviewProvider>,
  );
}

const rowFor = (name: string) => screen.getByRole("button", { name: new RegExp(name) });

describe("EnvironmentList", () => {
  it("renders the 4 seeded environments with Local active", () => {
    renderList();
    for (const n of ["Local", "Development", "QA", "Production"]) {
      expect(rowFor(n)).toBeDefined();
    }
    expect(within(rowFor("Local")).getByText("Active")).toBeDefined();
    expect(within(rowFor("QA")).queryByText("Active")).toBeNull();
  });

  it("moves the Active badge when a non-active row is clicked", () => {
    renderList();
    fireEvent.click(rowFor("QA"));
    expect(within(rowFor("QA")).getByText("Active")).toBeDefined();
    expect(within(rowFor("Local")).queryByText("Active")).toBeNull();
  });

  it("adds an environment that appears in the list and survives a rerender", () => {
    const { rerender } = renderList();
    fireEvent.click(screen.getByRole("button", { name: "Add environment" }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Staging" } });
    fireEvent.change(screen.getByLabelText("Base URL"), {
      target: { value: "https://staging.example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    expect(rowFor("Staging")).toBeDefined();

    rerender(
      <PreviewProvider>
        <EnvironmentList />
      </PreviewProvider>,
    );
    expect(rowFor("Staging")).toBeDefined();
  });
});
