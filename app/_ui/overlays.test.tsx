import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, describe, it, expect, vi } from "vitest";
import { Modal, Drawer, Tabs, Dropdown, Tooltip, useToast } from "./index";

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

  it("hideTitleVisually keeps the heading in the a11y tree with aria-labelledby intact", () => {
    render(
      <Modal open hideTitleVisually onClose={() => {}} title="Command palette">
        <p>x</p>
      </Modal>,
    );
    const heading = screen.getByRole("heading", { name: "Command palette" });
    expect(heading.className).toMatch(/visuallyHidden/);
    expect(heading.id).toBeTruthy();
    expect(screen.getByRole("dialog").getAttribute("aria-labelledby")).toBe(heading.id);
  });
});

describe("Tooltip", () => {
  it("puts aria-describedby on the child element, pointing at the role=tooltip tip", () => {
    render(
      <Tooltip label="hi">
        <button>x</button>
      </Tooltip>,
    );
    const btn = screen.getByRole("button", { name: "x" });
    const id = btn.getAttribute("aria-describedby");
    expect(id).toBeTruthy();
    const tip = document.getElementById(id!);
    expect(tip?.getAttribute("role")).toBe("tooltip");
    expect(tip?.textContent).toBe("hi");
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

  it("focuses the panel on open and restores focus to the trigger on close", () => {
    function Harness({ open }: { open: boolean }) {
      return (
        <>
          <button data-testid="trigger">open</button>
          <Drawer open={open} onClose={vi.fn()} aria-label="Details">
            <p>x</p>
          </Drawer>
        </>
      );
    }
    const { rerender } = render(<Harness open={false} />);
    const trigger = screen.getByTestId("trigger") as HTMLButtonElement;
    trigger.focus();

    rerender(<Harness open />);
    const panel = screen.getByRole("dialog").lastElementChild as HTMLElement;
    expect(document.activeElement).toBe(panel);

    rerender(<Harness open={false} />);
    expect(document.activeElement).toBe(trigger);
  });

  it("has an accessible name from aria-label", () => {
    render(
      <Drawer open onClose={vi.fn()} aria-label="Request detail">
        <p>x</p>
      </Drawer>,
    );
    expect(screen.getByRole("dialog", { name: "Request detail" })).toBeDefined();
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
  it("ArrowDown moves focus to the next item; Esc closes and restores trigger focus", () => {
    render(
      <Dropdown
        trigger={<span>menu</span>}
        items={[
          { label: "One", onSelect: vi.fn() },
          { label: "Two", onSelect: vi.fn() },
        ]}
      />,
    );
    const trigger = screen.getByRole("button");
    fireEvent.click(trigger);
    const items = screen.getAllByRole("menuitem");
    expect(document.activeElement).toBe(items[0]);
    fireEvent.keyDown(items[0]!, { key: "ArrowDown" });
    expect(document.activeElement).toBe(items[1]);
    fireEvent.keyDown(items[1]!, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

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
