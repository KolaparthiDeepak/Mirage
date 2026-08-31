import { renderHook, act, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDebounced } from "./use-debounced";

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

describe("useDebounced", () => {
  it("does not update the value before ms elapses", () => {
    const { result, rerender } = renderHook(({ value }) => useDebounced(value, 200), {
      initialProps: { value: "a" },
    });
    rerender({ value: "b" });
    act(() => vi.advanceTimersByTime(199));
    expect(result.current).toBe("a");
  });

  it("updates the value after ms elapses", () => {
    const { result, rerender } = renderHook(({ value }) => useDebounced(value, 200), {
      initialProps: { value: "a" },
    });
    rerender({ value: "b" });
    act(() => vi.advanceTimersByTime(200));
    expect(result.current).toBe("b");
  });
});
