import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, describe, it, expect, vi } from "vitest";
import type { RequestDraft } from "@/src/viewer/curl";
import { CodeGenerator } from "./CodeGenerator";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const draft: RequestDraft = {
  method: "POST",
  url: "$ORIGIN/m/x",
  headers: {},
  curl: 'curl -sS -X POST "$ORIGIN/m/x" -d \'{}\'',
  notes: [],
};

describe("CodeGenerator", () => {
  it("cURL tab shows the raw command with the stable $ORIGIN token", () => {
    const { container } = render(<CodeGenerator draft={draft} />);
    const pre = container.querySelector("pre")!;
    expect(pre.textContent).toContain("$ORIGIN");
    expect(pre.textContent).toContain("POST");
  });

  it("a language tab renders a preview note + Preview badge", () => {
    render(<CodeGenerator draft={draft} />);
    fireEvent.click(screen.getByRole("tab", { name: "Java" }));
    expect(
      screen.getByText("Code generation for Java is coming soon."),
    ).toBeDefined();
    expect(screen.getByText("Preview")).toBeDefined();
  });

  it("Copy button copies the resolved command (no $ORIGIN)", () => {
    const writeText = vi.fn();
    Object.assign(navigator, { clipboard: { writeText } });
    render(<CodeGenerator draft={draft} />);

    fireEvent.click(screen.getByText("Copy"));

    expect(writeText).toHaveBeenCalledOnce();
    expect(writeText.mock.calls[0]![0]).not.toContain("$ORIGIN");
  });

  it("copyCurlRef exposes an imperative copy for the ⌘⇧C shortcut", () => {
    const writeText = vi.fn();
    Object.assign(navigator, { clipboard: { writeText } });
    const copyCurlRef = { current: null as (() => void) | null };
    render(<CodeGenerator draft={draft} copyCurlRef={copyCurlRef} />);

    expect(typeof copyCurlRef.current).toBe("function");
    copyCurlRef.current!();
    expect(writeText.mock.calls[0]![0]).not.toContain("$ORIGIN");
  });
});
