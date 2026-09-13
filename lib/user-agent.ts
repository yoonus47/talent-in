/**
 * Coarse, dependency-free User-Agent parsing — just enough to answer "what
 * OS/browser is this" for platform-mix analytics (e.g. "how many students
 * are on iOS vs Android"), not a general-purpose UA library. Pure string
 * parsing, safe to call from either server or client code.
 *
 * One known, accepted limitation: iPadOS 13+ reports itself as a desktop
 * Mac in its User-Agent by default (Apple's own "Request Desktop Website"
 * default for iPad Safari) — there's no way to distinguish it from real
 * macOS from the UA string alone server-side. This undercounts iPad users
 * as "macos" rather than "ios" — a well-known, industry-wide limitation of
 * UA sniffing, not specific to this implementation.
 */

export type PlatformOs = "ios" | "android" | "windows" | "macos" | "linux" | "other";
export type PlatformBrowser =
  | "chrome"
  | "safari"
  | "firefox"
  | "edge"
  | "samsung internet"
  | "other";

export function parsePlatformOs(userAgent: string | null): PlatformOs {
  if (!userAgent) return "other";
  if (/iPhone|iPad|iPod/.test(userAgent)) return "ios";
  if (/Android/.test(userAgent)) return "android";
  if (/Windows/.test(userAgent)) return "windows";
  if (/Macintosh|Mac OS X/.test(userAgent)) return "macos";
  if (/Linux/.test(userAgent)) return "linux";
  return "other";
}

export function parsePlatformBrowser(userAgent: string | null): PlatformBrowser {
  if (!userAgent) return "other";
  // Order matters: Edge, Samsung Internet, and Chrome itself all include
  // "Chrome" (and everything short of IE includes "Safari") in their UA
  // string for compatibility — check the more specific tokens first.
  if (/Edg\//.test(userAgent)) return "edge";
  if (/SamsungBrowser/.test(userAgent)) return "samsung internet";
  if (/Chrome\//.test(userAgent)) return "chrome";
  if (/Firefox\//.test(userAgent)) return "firefox";
  if (/Safari\//.test(userAgent)) return "safari";
  return "other";
}
