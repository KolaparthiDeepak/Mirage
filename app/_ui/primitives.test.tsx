import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, it, expect, vi } from "vitest";
import { Button, MethodPill, StatusCode, Badge, CopyButton } from "./index";

afterEach(() => cleanup());

describe("ui primitives", () => {
  it("Button renders its variant as a data attribute and fires onClick", () => {
    const onClick = vi.fn();
    render(
      <Button variant="primary" onClick={onClick}>
        Go
      </Button>,
    );
    const b = screen.getByRole("button", { name: "Go" });
    expect(b.dataset.variant).toBe("primary");
    b.click();
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("MethodPill maps POST to the info tone", () => {
    render(<MethodPill method="POST" />);
    expect(screen.getByText("POST").dataset.tone).toBe("info");
  });

  it("StatusCode maps 404 to a 4xx kind", () => {
    render(<StatusCode code={404} />);
    expect(screen.getByText("404").dataset.kind).toBe("4");
  });

  it("Badge renders tone", () => {
    render(<Badge tone="success">ok</Badge>);
    expect(screen.getByText("ok").dataset.tone).toBe("success");
  });

  it("CopyButton renders a button with the default label", () => {
    render(<CopyButton text="hello" />);
    expect(screen.getByRole("button", { name: "Copy" })).toBeDefined();
  });
});
