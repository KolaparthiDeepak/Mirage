import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

describe("test infra", () => {
  it("renders a React component into jsdom", () => {
    render(<button>hello</button>);
    expect(screen.getByRole("button", { name: "hello" })).toBeDefined();
  });
});
