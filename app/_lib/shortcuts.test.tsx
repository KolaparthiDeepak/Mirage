import { render, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, describe, it, expect, vi } from "vitest";
import { matchCombo, useShortcuts, type ShortcutMap } from "./shortcuts";

afterEach(() => cleanup());

describe("matchCombo", () => {
  it("maps mod+k", () => {
    expect(matchCombo({ metaKey: true, key: "k" })).toBe("mod+k");
  });
  it("maps mod+shift+c (key uppercased by the browser)", () => {
    expect(matchCombo({ ctrlKey: true, shiftKey: true, key: "C" })).toBe("mod+shift+c");
  });
  it("maps Escape to esc without a mod", () => {
    expect(matchCombo({ key: "Escape" })).toBe("esc");
  });
  it("returns null for a bare key", () => {
    expect(matchCombo({ key: "a" })).toBeNull();
  });
  it("returns null when Alt is the only modifier", () => {
    expect(matchCombo({ altKey: true, key: "k" })).toBeNull();
  });
  it("maps mod+enter", () => {
    expect(matchCombo({ metaKey: true, key: "Enter" })).toBe("mod+enter");
  });
});

function Probe({ map }: { map: ShortcutMap }) {
  useShortcuts(map);
  return null;
}

describe("useShortcuts", () => {
  it("fires the handler for a matching combo", () => {
    const h = vi.fn();
    render(<Probe map={{ "mod+k": h }} />);
    fireEvent.keyDown(window, { key: "k", metaKey: true });
    expect(h).toHaveBeenCalledTimes(1);
  });

  it("suppresses non-allowed combos while typing in an input", () => {
    const h = vi.fn();
    render(
      <>
        <input data-testid="field" />
        <Probe map={{ "mod+e": h }} />
      </>,
    );
    (document.querySelector("[data-testid=field]") as HTMLInputElement).focus();
    fireEvent.keyDown(window, { key: "e", metaKey: true });
    expect(h).not.toHaveBeenCalled();
  });

  it("allows mod+k even while typing in an input (palette must open from search)", () => {
    const h = vi.fn();
    render(
      <>
        <input data-testid="field" />
        <Probe map={{ "mod+k": h }} />
      </>,
    );
    (document.querySelector("[data-testid=field]") as HTMLInputElement).focus();
    fireEvent.keyDown(window, { key: "k", metaKey: true });
    expect(h).toHaveBeenCalledTimes(1);
  });

  it("allows mod+enter even while typing in an input", () => {
    const h = vi.fn();
    render(
      <>
        <input data-testid="field" />
        <Probe map={{ "mod+enter": h }} />
      </>,
    );
    (document.querySelector("[data-testid=field]") as HTMLInputElement).focus();
    fireEvent.keyDown(window, { key: "Enter", metaKey: true });
    expect(h).toHaveBeenCalledTimes(1);
  });
});
