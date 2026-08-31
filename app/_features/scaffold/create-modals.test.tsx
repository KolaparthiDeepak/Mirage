import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { ToastProvider } from "@/app/_ui";
import type { EndpointVM } from "@/src/viewer/model";
import { CreateProjectModal } from "@/app/_features/projects/CreateProjectModal";
import { CreateEndpointModal } from "@/app/_features/endpoints/CreateEndpointModal";
import { CreateCaseModal } from "@/app/_features/cases/CreateCaseModal";

afterEach(() => cleanup());

let fetchSpy: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchSpy = vi.fn(() => Promise.reject(new Error("no network in tests")));
  global.fetch = fetchSpy as unknown as typeof fetch;
});

function wrap(ui: React.ReactNode) {
  return render(<ToastProvider>{ui}</ToastProvider>);
}

describe("CreateProjectModal", () => {
  it("shows a live slug preview and emits YAML with a Preview badge, no fetch", () => {
    wrap(<CreateProjectModal open onClose={() => {}} />);

    const name = screen.getByPlaceholderText("My API");
    fireEvent.change(name, { target: { value: "Card Service" } });
    expect(screen.getByText("slug: card-service")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "Generate YAML" }));

    const pre = document.querySelector("pre")!;
    expect(pre.textContent).toContain('name: "Card Service"');
    expect(pre.textContent).toContain("slug: card-service");
    expect(screen.getByText("Preview")).toBeDefined();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("CreateEndpointModal", () => {
  it("emits YAML with the chosen method and path", () => {
    wrap(<CreateEndpointModal open onClose={() => {}} />);

    fireEvent.change(screen.getByPlaceholderText("/my/path"), {
      target: { value: "/x" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Generate YAML" }));

    const pre = document.querySelector("pre")!;
    expect(pre.textContent).toContain("method: POST");
    expect(pre.textContent).toContain('path: "/x"');
    expect(pre.textContent).toContain("id: post-x-ok");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

const endpoint: EndpointVM = {
  key: "acropolis/BLOCK_CARD/v1",
  method: "POST",
  path: "/acropolis-card-mgmt/BLOCK_CARD/v1",
  runUrl: "/m/x",
  cases: [],
};

describe("CreateCaseModal", () => {
  it("emits YAML with the slugified id and chosen status", () => {
    wrap(<CreateCaseModal open onClose={() => {}} endpoint={endpoint} />);

    fireEvent.change(screen.getByPlaceholderText("card blocked"), {
      target: { value: "Card Blocked" },
    });
    fireEvent.change(screen.getByDisplayValue("200"), {
      target: { value: "404" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Generate YAML" }));

    const pre = document.querySelector("pre")!;
    expect(pre.textContent).toContain('id: "card-blocked"');
    expect(pre.textContent).toContain("status: 404");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
