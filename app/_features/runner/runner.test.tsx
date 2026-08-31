import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, describe, it, expect, vi } from "vitest";
import { BodyEditor } from "./BodyEditor";
import { HeadersEditor } from "./HeadersEditor";

afterEach(() => cleanup());

describe("BodyEditor", () => {
  it("pretty-prints valid JSON on Format, calling onChange once", () => {
    const onChange = vi.fn();
    render(<BodyEditor value={'{"a":1}'} onChange={onChange} />);
    fireEvent.click(screen.getByText("Format"));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('{\n  "a": 1\n}');
  });

  it("marks invalid JSON without calling onChange, and clears the marker on edit", () => {
    const onChange = vi.fn();
    render(<BodyEditor value={"{bad"} onChange={onChange} />);
    fireEvent.click(screen.getByText("Format"));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText(/invalid json/i)).toBeDefined();

    fireEvent.change(screen.getByLabelText("Request body"), {
      target: { value: "{bad2" },
    });
    expect(screen.queryByText(/invalid json/i)).toBeNull();
  });
});

describe("HeadersEditor", () => {
  it("calls onChange with the new value when typed into", () => {
    const onChange = vi.fn();
    render(<HeadersEditor value="" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Request headers"), {
      target: { value: "Authorization: Bearer x" },
    });
    expect(onChange).toHaveBeenCalledWith("Authorization: Bearer x");
  });
});
