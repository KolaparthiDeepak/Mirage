import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, describe, it, expect, vi } from "vitest";
import { AppError } from "./AppError";

afterEach(() => cleanup());

describe("AppError", () => {
  it("shows the heading and the error message, no stack", () => {
    render(<AppError error={new Error("boom")} reset={() => {}} />);
    expect(
      screen.getByRole("heading", { name: /something went off-script/i }),
    ).toBeDefined();
    expect(screen.getByText("boom")).toBeDefined();
  });

  it("calls reset once when Try again is clicked", () => {
    const reset = vi.fn();
    render(<AppError error={new Error("boom")} reset={reset} />);
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("links back to projects", () => {
    render(<AppError error={new Error("x")} reset={() => {}} />);
    expect(
      screen.getByRole("link", { name: /back to projects/i }).getAttribute("href"),
    ).toBe("/projects");
  });
});
