"use client";

/**
 * Last-resort boundary — only fires if the root layout itself throws
 * (app/error.tsx covers everything else, and won't catch that case per
 * Next's docs). This replaces the *entire* HTML document, so it must
 * define its own <html>/<body> and — per node_modules/next/dist/docs/
 * 01-app/03-api-reference/03-file-conventions/error.md — never receives
 * this app's global stylesheet or theme: inline styles only, no
 * Tailwind classes, no CSS variables from globals.css.
 */
export default function GlobalError({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
          background: "#ffffff",
          color: "#262626",
        }}
      >
        <div style={{ textAlign: "center", padding: "2rem", maxWidth: "24rem" }}>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>
            Something went wrong
          </h1>
          <p style={{ marginTop: "0.5rem", fontSize: "0.875rem", color: "#8e8e8e" }}>
            TalentZify hit a snag loading. Try again in a moment.
          </p>
          <button
            type="button"
            onClick={() => retry()}
            style={{
              marginTop: "1.5rem",
              padding: "0.5rem 1.25rem",
              borderRadius: "0.5rem",
              border: "none",
              background: "#070a8f",
              color: "#ffffff",
              fontSize: "0.875rem",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
