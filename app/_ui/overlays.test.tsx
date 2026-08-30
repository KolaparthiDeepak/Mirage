import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, describe, it, expect, vi } from "vitest";
import { Modal, Drawer, Tabs, Dropdown, useToast } from "./index";

afterEach(() => cleanup());

describe("Modal", () => {
  it("closes on Escape", () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="T">
        <p>x</p>
      </Modal>,
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("is hidden (not display:none) when closed", () => {
    render(
      <Modal open={false} onClose={() => {}} title="T">
        <p>x</p>
      </Modal>,
    );
    expect(
      screen.getByRole("dialog", { hidden: true }).hasAttribute("hidden"),
    ).toBe(true);
  });
});

describe("Drawer", () => {
  it("closes on Escape", () => {
    const onClose = vi.fn();
    render(
      <Drawer open onClose={onClose}>
        <p>x</p>
      </Drawer>,
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });
});

describe("Tabs", () => {
  it("ArrowRight advances the active tab", () => {
    const onChange = vi.fn();
    render(
      <Tabs
        tabs={[
          { id: "a", label: "A" },
          { id: "b", label: "B" },
        ]}
        active="a"
        onChange={onChange}
      />,
    );
    fireEvent.keyDown(screen.getByRole("tab", { name: "A" }), {
      key: "ArrowRight",
    });
    expect(onChange).toHaveBeenCalledWith("b");
  });
});

describe("Dropdown", () => {
  it("does not fire onSelect for a disabled item", () => {
    const onSelect = vi.fn();
    render(
      <Dropdown
        trigger={<span>menu</span>}
        items={[{ label: "Nope", onSelect, disabled: true }]}
      />,
    );
    fireEvent.click(screen.getByText("menu"));
    fireEvent.click(screen.getByRole("menuitem", { name: "Nope" }));
    expect(onSelect).not.toHaveBeenCalled();
  });
});

describe("useToast", () => {
  it("throws when used outside a ToastProvider", () => {
    function Bad() {
      useToast();
      return null;
    }
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Bad />)).toThrow();
    spy.mockRestore();
  });
});
