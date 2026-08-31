import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import { afterEach, describe, it, expect } from "vitest";
import { PreviewProvider } from "@/app/_lib/preview-store";
import { VariableTable } from "./VariableTable";

afterEach(() => {
  cleanup();
  sessionStorage.clear();
});

function renderTable() {
  return render(
    <PreviewProvider>
      <VariableTable />
    </PreviewProvider>,
  );
}

function addVariable(name: string, value: string, scope: string) {
  fireEvent.click(screen.getByRole("button", { name: "Add variable" }));
  fireEvent.change(screen.getByLabelText("Name"), { target: { value: name } });
  fireEvent.change(screen.getByLabelText("Value"), { target: { value } });
  fireEvent.change(screen.getByLabelText("Scope"), { target: { value: scope } });
  fireEvent.click(screen.getByRole("button", { name: "Add" }));
}

const rowFor = (key: string) =>
  screen.getByRole("row", { name: new RegExp(key) });

describe("VariableTable", () => {
  it("renders the empty state when no variables are seeded", () => {
    renderTable();
    expect(screen.getByText("No variables")).toBeDefined();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("adds a variable that shows masked, with its scope badge, and survives a rerender", () => {
    const { rerender } = renderTable();
    addVariable("API_KEY", "sk-123", "QA");

    const row = rowFor("API_KEY");
    expect(within(row).getByText("••••••••")).toBeDefined();
    expect(within(row).queryByText("sk-123")).toBeNull();
    expect(within(row).getByText("QA")).toBeDefined();

    rerender(
      <PreviewProvider>
        <VariableTable />
      </PreviewProvider>,
    );
    expect(rowFor("API_KEY")).toBeDefined();
  });

  it("reveals and re-hides a value per row", () => {
    renderTable();
    addVariable("API_KEY", "sk-123", "QA");

    fireEvent.click(within(rowFor("API_KEY")).getByRole("button", { name: "Reveal" }));
    expect(within(rowFor("API_KEY")).getByText("sk-123")).toBeDefined();

    fireEvent.click(within(rowFor("API_KEY")).getByRole("button", { name: "Hide" }));
    expect(within(rowFor("API_KEY")).queryByText("sk-123")).toBeNull();
    expect(within(rowFor("API_KEY")).getByText("••••••••")).toBeDefined();
  });

  it("deletes a row", () => {
    renderTable();
    addVariable("API_KEY", "sk-123", "QA");
    expect(rowFor("API_KEY")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "Delete API_KEY" }));
    expect(screen.queryByText("API_KEY")).toBeNull();
  });
});
