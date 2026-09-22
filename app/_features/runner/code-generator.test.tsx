import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { afterEach, describe, it, expect, vi } from "vitest";
import type { RequestDraft } from "@/src/viewer/curl";
import { ToastProvider } from "@/app/_ui";
import { PreviewProvider, usePreview } from "@/app/_lib/preview-store";
import { CodeGenerator } from "./CodeGenerator";

const originalClipboard = Object.getOwnPropertyDescriptor(navigator, "clipboard");

function stubClipboard(writeText: (v: string) => Promise<void>) {
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
  });
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  sessionStorage.clear();
  if (originalClipboard) Object.defineProperty(navigator, "clipboard", originalClipboard);
  else delete (navigator as { clipboard?: unknown }).clipboard;
});

function EnvProbe({ id, name, baseUrl }: { id: string; name: string; baseUrl: string }) {
  const { set } = usePreview();
  return (
    <button
      onClick={() =>
        set((s) => ({
          ...s,
          environments: [...s.environments, { id, name, baseUrl }],
          activeEnvId: id,
        }))
      }
    >
      env-{id}
    </button>
  );
}

const draft: RequestDraft = {
  method: "POST",
  url: "$ORIGIN/m/x",
  headers: {},
  curl: 'curl -sS -X POST "$ORIGIN/m/x" -d \'{}\'',
  notes: [],
};

function renderGen(props: Partial<Parameters<typeof CodeGenerator>[0]> = {}) {
  return render(
    <PreviewProvider>
      <ToastProvider>
        <EnvProbe id="qa" name="QA" baseUrl="https://qa.mirage.dailyuze.com" />
        <CodeGenerator draft={draft} {...props} />
      </ToastProvider>
    </PreviewProvider>,
  );
}

describe("CodeGenerator", () => {
  it("cURL tab renders the command, resolving $ORIGIN after mount", async () => {
    const { container } = renderGen();
    const pre = container.querySelector("pre")!;
    expect(pre.textContent).toContain("POST");
    // First paint may still show the SSR-stable placeholder; after mount it
    // becomes the real origin. Either is acceptable.
    await waitFor(() =>
      expect(pre.textContent).toContain(window.location.origin),
    );
    expect(pre.textContent).not.toContain("$ORIGIN");
  });

  it("resolves $ORIGIN to the active env baseUrl when it is not Local", async () => {
    const { container } = renderGen();
    fireEvent.click(screen.getByText("env-qa"));
    const pre = container.querySelector("pre")!;
    await waitFor(() =>
      expect(pre.textContent).toContain(
        "https://qa.mirage.dailyuze.com/m/x",
      ),
    );
    expect(pre.textContent).not.toContain("$ORIGIN");
  });

  it("a language tab renders a preview note + Preview badge", () => {
    renderGen();
    fireEvent.click(screen.getByRole("tab", { name: "Java" }));
    expect(
      screen.getByText("Code generation for Java is coming soon."),
    ).toBeDefined();
    expect(screen.getByText("Preview")).toBeDefined();
  });

  it("Copy button copies the resolved command (no $ORIGIN)", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubClipboard(writeText);
    renderGen();

    fireEvent.click(screen.getByText("Copy"));

    await waitFor(() => expect(writeText).toHaveBeenCalledOnce());
    expect(writeText.mock.calls[0]![0]).not.toContain("$ORIGIN");
  });

  it("copyCurlRef exposes an imperative copy for the ⌘⇧C shortcut", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubClipboard(writeText);
    const copyCurlRef = { current: null as (() => void) | null };
    renderGen({ copyCurlRef });

    expect(typeof copyCurlRef.current).toBe("function");
    copyCurlRef.current!();
    await waitFor(() => expect(writeText).toHaveBeenCalledOnce());
    expect(writeText.mock.calls[0]![0]).not.toContain("$ORIGIN");
  });
});
