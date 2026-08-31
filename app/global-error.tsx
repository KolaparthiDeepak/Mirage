"use client";

// Catches failures in the root layout and the (app) layout itself (buildViewModel
// on a malformed mocks.generated.json) — the one place app/(app)/error.tsx cannot
// reach. Next renders this in place of <html>, so it must ship its own <html>/<body>
// and cannot rely on CSS modules, tokens.css, or providers; inline styles with CSS
// system colors (no design tokens available) only, here.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "12px",
          fontFamily: "system-ui, sans-serif",
          color: "CanvasText",
          background: "Canvas",
          padding: "24px",
          textAlign: "center",
        }}
      >
        <h2 style={{ margin: 0, fontSize: "18px" }}>Something went badly wrong.</h2>
        <p style={{ margin: 0, opacity: 0.7, fontSize: "14px" }}>{error.message}</p>
        {error.digest && (
          <p style={{ margin: 0, opacity: 0.5, fontSize: "12px" }}>Reference: {error.digest}</p>
        )}
        <button
          type="button"
          onClick={reset}
          style={{
            marginTop: "8px",
            padding: "8px 16px",
            fontSize: "14px",
            borderRadius: "6px",
            border: "1px solid GrayText",
            background: "ButtonFace",
            color: "ButtonText",
            cursor: "pointer",
          }}
        >
          Reload
        </button>
      </body>
    </html>
  );
}
