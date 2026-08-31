import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, it, expect } from "vitest";
import { JsonView } from "./index";

afterEach(() => cleanup());

describe("JsonView", () => {
  it("renders key spans for valid JSON", () => {
    const { container } = render(<JsonView value={'{"a":1}'} />);
    expect(container.querySelector(".j-key")).not.toBeNull();
  });

  it("renders raw text with a marker for invalid JSON", () => {
    render(<JsonView value={"{not json"} />);
    expect(screen.getByText("{not json").closest("[data-invalid]")).not.toBeNull();
  });
});
