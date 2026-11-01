// Same-site relative path from untrusted input (a `?next=` query param or a
// hidden form field), or null. Rejects `//host` and `/\host`, which browsers
// resolve as another origin, and control characters.
export function safeNextPath(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return null;
  if (/[\u0000-\u001f]/.test(raw)) return null;
  return raw;
}

// ?welcome=1 triggers components/brand-splash.tsx's entrance animation.
export function withWelcome(path: string): string {
  return `${path}${path.includes("?") ? "&" : "?"}welcome=1`;
}
