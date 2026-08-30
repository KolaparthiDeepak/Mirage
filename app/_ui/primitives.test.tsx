import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, describe, it, expect, vi } from "vitest";
import { Button, MethodPill, StatusCode, Badge, CopyButton, ToastProvider } from "./index";

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
    render(
      <ToastProvider>
        <CopyButton text="hello" />
      </ToastProvider>,
    );
    expect(screen.getByRole("button", { name: "Copy" })).toBeDefined();
  });

  it("CopyButton flips to 'Copied' on a successful write", async () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
    render(
      <ToastProvider>
        <CopyButton text="hello" />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Copied" })).toBeDefined());
  });

  it("CopyButton stays 'Copy' and toasts when the write rejects", async () => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
    });
    render(
      <ToastProvider>
        <CopyButton text="hello" />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    await waitFor(() => expect(screen.getByText(/couldn't copy/i)).toBeDefined());
    expect(screen.getByRole("button", { name: "Copy" })).toBeDefined();
  });
});
