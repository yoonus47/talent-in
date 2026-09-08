import { promises as dnsPromises } from "node:dns";
import net from "node:net";
import { Agent, fetch as undiciFetch } from "undici";

/**
 * Fetches a user-supplied URL server-side and extracts basic Open Graph
 * metadata for a link-preview card. This is the one genuinely security-
 * sensitive part of that feature — an authenticated user chooses the URL,
 * the server fetches it — so it's deliberately defensive:
 *
 *  - protocol allowlist (http/https only)
 *  - DNS-resolved, private/reserved-IP-range rejected (see
 *    isPrivateOrReservedIp below for exactly why, given this app runs on
 *    AWS Amplify/Lambda specifically)
 *  - the actual TCP connection is pinned to the IP already validated,
 *    closing the classic "resolve, check, then let fetch() re-resolve on
 *    its own clock" DNS-rebinding gap
 *  - redirects followed manually, each hop re-validated + re-pinned
 *    before being followed, capped at a few hops
 *  - a timeout and a cap on how much of the response body is read
 *  - only text/html is parsed
 *
 * This is solid for this app's actual threat model (an accountable,
 * already-authenticated user) but isn't exhaustive against a determined
 * attacker with active DNS control beyond the rebinding case closed here.
 */

const FETCH_TIMEOUT_MS = 5_000;
const MAX_RESPONSE_BYTES = 300_000; // meta tags are always near the top of <head>
const MAX_REDIRECTS = 3;
const USER_AGENT = "TalentZifyLinkPreview/1.0 (+https://talentzify.com)";

export type LinkMetadata = {
  title: string;
  description: string | null;
  imageUrl: string | null;
  siteName: string | null;
};

/**
 * Rejects loopback, RFC1918 private ranges, link-local (169.254.0.0/16 —
 * covers both the classic EC2 IMDS address AND, critically for this app's
 * actual deployment, the address a Lambda container exposes its execution
 * role's temporary AWS credentials on — a successful SSRF into this range
 * here is potential credential theft, not just "reached an internal
 * service"), carrier-grade NAT (100.64.0.0/10, sometimes used inside cloud
 * VPCs), and the IPv6 equivalents — including IPv4-mapped IPv6 forms
 * (::ffff:127.0.0.1), unwrapped and re-checked as the embedded IPv4
 * address.
 */
function isPrivateOrReservedIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const parts = ip.split(".").map(Number);
    const [a, b] = parts;
    if (a === 0) return true; // 0.0.0.0/8
    if (a === 10) return true; // 10.0.0.0/8
    if (a === 127) return true; // loopback
    if (a === 169 && b === 254) return true; // 169.254.0.0/16 (link-local)
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 (CGNAT)
    return false;
  }

  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "::") return true; // loopback / unspecified
  if (lower.startsWith("fe80:") || lower.startsWith("fe80::")) return true; // link-local
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // unique local (fc00::/7)
  if (lower.startsWith("::ffff:")) {
    return isPrivateOrReservedIp(lower.slice("::ffff:".length));
  }
  return false;
}

/** Resolves a hostname and confirms every returned address is public. */
async function resolvesToPublicAddress(hostname: string): Promise<string | null> {
  let records;
  try {
    records = await dnsPromises.lookup(hostname, { all: true, verbatim: true });
  } catch {
    return null; // can't resolve it — refuse rather than risk an ambiguous fetch
  }
  if (records.length === 0) return null;
  if (records.some((r) => isPrivateOrReservedIp(r.address))) return null;
  // The address this request will actually be pinned to (see below) —
  // picking the first resolved address is fine since we've already
  // confirmed none of them are private/reserved.
  return records[0].address;
}

/** Builds an Agent whose every connection is pinned to `ip`, instead of
 * letting undici re-resolve the hostname itself later on its own clock —
 * the actual fix for DNS rebinding, not just a documented limitation.
 * Host/SNI still go to the request URL's real hostname (unchanged), so
 * TLS certificate validation still works correctly against it, not the
 * IP — only the socket's actual destination is pinned. Callers must
 * `close()` this once fully done with the response (including its body),
 * not right after the headers arrive — closing early can cut a body
 * that's still streaming over this same connection. */
function pinnedAgent(ip: string): Agent {
  return new Agent({
    connect: {
      // Confirmed empirically (scripts/tmp-verify-ssrf-guard.mjs, before
      // it was deleted): Node's connect() internals here actually expect
      // the array-of-records callback shape (the same shape
      // dns.lookup(host, {all:true}) itself returns), not the plain
      // (err, address, family) form its own TS types also allow — passing
      // the plain form throws ERR_INVALID_IP_ADDRESS deep inside net's
      // "happy eyeballs" connect path.
      lookup: (_hostname, _options, callback) => {
        callback(null, [{ address: ip, family: net.isIPv6(ip) ? 6 : 4 }]);
      },
    },
  });
}

/** Fetches `startUrl`, following redirects manually (each hop resolved,
 * validated, and pinned fresh before being followed), and returns up to
 * MAX_RESPONSE_BYTES of the body if it's text/html — or null if anything
 * along the way fails validation. */
async function safeFetchHtml(startUrl: string): Promise<string | null> {
  let current: URL;
  try {
    current = new URL(startUrl);
  } catch {
    return null;
  }

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (current.protocol !== "http:" && current.protocol !== "https:") return null;

    const ip = await resolvesToPublicAddress(current.hostname);
    if (!ip) return null;

    const agent = pinnedAgent(ip);
    try {
      const res = await undiciFetch(current, {
        dispatcher: agent,
        redirect: "manual",
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: { "user-agent": USER_AGENT, accept: "text/html" },
      });

      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get("location");
        if (!location) return null;
        current = new URL(location, current);
        continue; // next loop iteration resolves + pins the NEW host
      }

      if (!res.ok) return null;
      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.includes("text/html")) return null;

      const reader = res.body?.getReader();
      if (!reader) return null;
      const chunks: Uint8Array[] = [];
      let total = 0;
      while (total < MAX_RESPONSE_BYTES) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        total += value.length;
      }
      void reader.cancel().catch(() => {});
      return Buffer.concat(chunks).toString("utf-8");
    } catch {
      return null;
    } finally {
      void agent.close().catch(() => {});
    }
  }

  return null; // too many redirects
}

const ENTITY_MAP: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
};

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;|&lt;|&gt;|&quot;|&#39;|&apos;|&nbsp;/g, (m) => ENTITY_MAP[m])
    .replace(/&#(\d+);/g, (_m, code) => String.fromCharCode(Number(code)));
}

/** Matches a <meta> tag by its property/name attribute, either attribute
 * order, either quote style — returns the decoded content, or null. */
function extractMeta(html: string, key: string): string | null {
  const attrPattern = key.startsWith("og:") ? "property" : "name";
  const re = new RegExp(
    `<meta[^>]*(?:${attrPattern})=["']${key.replace(":", "\\:")}["'][^>]*content=["']([^"']*)["']` +
      `|<meta[^>]*content=["']([^"']*)["'][^>]*(?:${attrPattern})=["']${key.replace(":", "\\:")}["']`,
    "i",
  );
  const match = re.exec(html);
  const raw = match?.[1] ?? match?.[2];
  return raw ? decodeHtmlEntities(raw.trim()) : null;
}

function extractTitleTag(html: string): string | null {
  const match = /<title[^>]*>([^<]*)<\/title>/i.exec(html);
  return match?.[1] ? decodeHtmlEntities(match[1].trim()) : null;
}

/**
 * Fetches `url` (through the guarded path above) and extracts Open Graph
 * metadata, falling back to <title>/<meta name="description"> when a site
 * doesn't set OG tags. Returns null if the fetch failed, the page isn't
 * HTML, or there's no title at all (an empty husk of a card is worse than
 * no card — the caller falls back to a plain clickable link either way).
 */
export async function fetchLinkMetadata(url: string): Promise<LinkMetadata | null> {
  const html = await safeFetchHtml(url);
  if (!html) return null;

  const title = extractMeta(html, "og:title") ?? extractTitleTag(html);
  if (!title) return null;

  const description = extractMeta(html, "og:description") ?? extractMeta(html, "description");

  let imageUrl = extractMeta(html, "og:image");
  if (imageUrl) {
    try {
      const resolved = new URL(imageUrl, url);
      // Only https — an http image on our https-served page gets silently
      // mixed-content-blocked by the browser anyway; better to drop the
      // thumbnail (text-only card) than ship a URL we know won't load.
      imageUrl = resolved.protocol === "https:" ? resolved.toString() : null;
    } catch {
      imageUrl = null;
    }
  }

  const siteName = extractMeta(html, "og:site_name");

  return {
    title: title.slice(0, 200),
    description: description?.slice(0, 300) ?? null,
    imageUrl,
    siteName,
  };
}
