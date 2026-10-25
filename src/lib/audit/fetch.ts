import { lookup as dnsLookup } from "node:dns/promises";
import net from "node:net";

export type FetchErrorCode = "invalid_url" | "blocked_host" | "fetch_failed" | "not_html";

export class FetchError extends Error {
  code: FetchErrorCode;
  constructor(code: FetchErrorCode, message: string) {
    super(message);
    this.name = "FetchError";
    this.code = code;
  }
}

export const USER_AGENT =
  "Mozilla/5.0 (compatible; AIVisibilityChecker/1.0; +https://github.com/)";

export type Resolver = (hostname: string) => Promise<{ address: string; family: number }[]>;

const defaultResolver: Resolver = (hostname) => dnsLookup(hostname, { all: true });

// ---------------------------------------------------------------------------
// URL normalisation
// ---------------------------------------------------------------------------

/** Trim, add https:// when there is no scheme, and parse. Throws FetchError(invalid_url). */
export function normaliseUrl(input: string): URL {
  const trimmed = (input ?? "").trim();
  if (!trimmed) throw new FetchError("invalid_url", "Enter a web address to check.");
  if (trimmed.length > 2048) throw new FetchError("invalid_url", "That web address is too long.");
  const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) || /^(mailto|javascript|data|file):/i.test(trimmed);
  const withScheme = hasScheme ? trimmed : `https://${trimmed}`;
  try {
    return new URL(withScheme);
  } catch {
    throw new FetchError("invalid_url", "That does not look like a valid web address.");
  }
}

// ---------------------------------------------------------------------------
// SSRF guard
// ---------------------------------------------------------------------------

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null;
    const v = Number(p);
    if (v > 255) return null;
    n = n * 256 + v;
  }
  return n;
}

const V4_BLOCKS: [string, number][] = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10], // carrier-grade NAT
  ["127.0.0.0", 8],
  ["169.254.0.0", 16], // link-local, cloud metadata
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15], // benchmarking
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // reserved + broadcast
];

function isBlockedV4(ip: string): boolean {
  const n = ipv4ToInt(ip);
  if (n === null) return true; // unparseable: refuse
  return V4_BLOCKS.some(([base, bits]) => {
    const b = ipv4ToInt(base) as number;
    const size = 2 ** (32 - bits);
    return n >= b && n < b + size;
  });
}

/** Expand an IPv6 literal into 8 16-bit groups, or null if it cannot be parsed. */
function expandV6(ip: string): number[] | null {
  let addr = ip.split("%")[0].toLowerCase();
  // Embedded dotted IPv4 tail (e.g. ::ffff:127.0.0.1)
  const dotted = addr.match(/^(.*:)(\d+\.\d+\.\d+\.\d+)$/);
  if (dotted) {
    const v4 = ipv4ToInt(dotted[2]);
    if (v4 === null) return null;
    addr = dotted[1] + ((v4 >>> 16) & 0xffff).toString(16) + ":" + (v4 & 0xffff).toString(16);
  }
  const halves = addr.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  let groups: string[];
  if (halves.length === 2) {
    const missing = 8 - head.length - tail.length;
    if (missing < 0) return null;
    groups = [...head, ...Array<string>(missing).fill("0"), ...tail];
  } else {
    groups = head;
  }
  if (groups.length !== 8) return null;
  const out: number[] = [];
  for (const g of groups) {
    if (!/^[0-9a-f]{1,4}$/.test(g)) return null;
    out.push(parseInt(g, 16));
  }
  return out;
}

function isBlockedV6(ip: string): boolean {
  const g = expandV6(ip);
  if (!g) return true;
  const allZeroUpTo = (n: number) => g.slice(0, n).every((x) => x === 0);
  if (allZeroUpTo(7) && (g[7] === 0 || g[7] === 1)) return true; // :: and ::1
  // IPv4-mapped ::ffff:a.b.c.d and IPv4-compatible ::a.b.c.d
  if (allZeroUpTo(5) && (g[5] === 0xffff || g[5] === 0)) {
    return isBlockedV4(`${g[6] >> 8}.${g[6] & 255}.${g[7] >> 8}.${g[7] & 255}`);
  }
  // NAT64 64:ff9b::/96 embeds an IPv4 address
  if (g[0] === 0x64 && g[1] === 0xff9b && g.slice(2, 6).every((x) => x === 0)) {
    return isBlockedV4(`${g[6] >> 8}.${g[6] & 255}.${g[7] >> 8}.${g[7] & 255}`);
  }
  if ((g[0] & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
  if ((g[0] & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((g[0] & 0xff00) === 0xff00) return true; // ff00::/8 multicast
  if (g[0] === 0x2001 && g[1] === 0x0db8) return true; // documentation
  return false;
}

/** True when an IP literal points at a non-public address. */
export function isBlockedIp(ip: string): boolean {
  const clean = ip.replace(/^\[|\]$/g, "");
  const kind = net.isIP(clean);
  if (kind === 4) return isBlockedV4(clean);
  if (kind === 6) return isBlockedV6(clean);
  return true;
}

function isBlockedHostname(host: string): boolean {
  const h = host.toLowerCase().replace(/\.$/, "");
  return (
    h === "localhost" ||
    h.endsWith(".localhost") ||
    h.endsWith(".local") ||
    h.endsWith(".internal") ||
    h.endsWith(".localdomain") ||
    h.endsWith(".lan") ||
    h.endsWith(".home.arpa") ||
    h === "metadata.google.internal"
  );
}

/**
 * Throws FetchError unless `url` is a public http(s) address on port 80/443.
 * Resolves the hostname and rejects if ANY resolved address is non-public.
 */
export async function assertSafeUrl(url: URL, resolver: Resolver = defaultResolver): Promise<void> {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new FetchError("invalid_url", "Only http and https addresses can be checked.");
  }
  if (url.username || url.password) {
    throw new FetchError("invalid_url", "Addresses that contain a username or password are not supported.");
  }
  if (url.port && url.port !== "80" && url.port !== "443") {
    throw new FetchError("blocked_host", "Only standard web ports (80 and 443) can be checked.");
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (!host) throw new FetchError("invalid_url", "That does not look like a valid web address.");
  if (isBlockedHostname(host)) {
    throw new FetchError("blocked_host", "That address points at a private or internal host, so it cannot be checked.");
  }
  if (net.isIP(host)) {
    if (isBlockedIp(host)) {
      throw new FetchError("blocked_host", "That address points at a private or internal host, so it cannot be checked.");
    }
    return;
  }
  let addrs: { address: string; family: number }[];
  try {
    addrs = await resolver(host);
  } catch {
    throw new FetchError("fetch_failed", `We could not find a website at ${host}. Check the spelling of the address.`);
  }
  if (!addrs.length) {
    throw new FetchError("fetch_failed", `We could not find a website at ${host}. Check the spelling of the address.`);
  }
  if (addrs.some((a) => isBlockedIp(a.address))) {
    throw new FetchError("blocked_host", "That address points at a private or internal host, so it cannot be checked.");
  }
}

// ---------------------------------------------------------------------------
// Safe fetch
// ---------------------------------------------------------------------------

export interface SafeFetchOptions {
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
  accept?: string;
  resolver?: Resolver;
  /** Override for tests. */
  fetchImpl?: typeof fetch;
}

export interface SafeFetchResult {
  status: number;
  finalUrl: string;
  headers: Record<string, string>;
  text: string;
  /** True when the body hit the byte cap and was cut off. */
  truncated: boolean;
  redirects: string[];
}

const REDIRECT_CODES = new Set([301, 302, 303, 307, 308]);

function decoderFor(contentType: string | null): TextDecoder {
  const m = contentType?.match(/charset=["']?([\w-]+)/i);
  if (m) {
    try {
      return new TextDecoder(m[1]);
    } catch {
      /* fall through to utf-8 */
    }
  }
  return new TextDecoder("utf-8");
}

async function readCapped(res: Response, maxBytes: number): Promise<{ text: string; truncated: boolean }> {
  const decoder = decoderFor(res.headers.get("content-type"));
  if (!res.body) return { text: "", truncated: false };
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  let truncated = false;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    if (total + value.byteLength > maxBytes) {
      chunks.push(value.subarray(0, maxBytes - total));
      total = maxBytes;
      truncated = true;
      await reader.cancel().catch(() => undefined);
      break;
    }
    chunks.push(value);
    total += value.byteLength;
  }
  const buf = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    buf.set(c, off);
    off += c.byteLength;
  }
  return { text: decoder.decode(buf), truncated };
}

function isTimeout(err: unknown): boolean {
  return err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
}

export async function safeFetch(input: string | URL, opts: SafeFetchOptions = {}): Promise<SafeFetchResult> {
  const timeoutMs = opts.timeoutMs ?? 10_000;
  const maxBytes = opts.maxBytes ?? 2 * 1024 * 1024;
  const maxRedirects = opts.maxRedirects ?? 5;
  const doFetch = opts.fetchImpl ?? fetch;
  const signal = AbortSignal.timeout(timeoutMs);

  let current = typeof input === "string" ? normaliseUrl(input) : new URL(input.toString());
  const redirects: string[] = [];

  for (let hop = 0; hop <= maxRedirects; hop++) {
    await assertSafeUrl(current, opts.resolver);
    let res: Response;
    try {
      res = await doFetch(current.toString(), {
        method: "GET",
        redirect: "manual",
        signal,
        headers: {
          "User-Agent": USER_AGENT,
          Accept: opts.accept ?? "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en",
        },
      });
    } catch (err) {
      if (isTimeout(err)) {
        throw new FetchError(
          "fetch_failed",
          `The site took longer than ${Math.round(timeoutMs / 1000)} seconds to respond.`,
        );
      }
      throw new FetchError("fetch_failed", `We could not connect to ${current.hostname}.`);
    }

    if (REDIRECT_CODES.has(res.status)) {
      const location = res.headers.get("location");
      await res.body?.cancel().catch(() => undefined);
      if (location) {
        let next: URL;
        try {
          next = new URL(location, current);
        } catch {
          throw new FetchError("fetch_failed", "The site redirected to an address we could not read.");
        }
        redirects.push(next.toString());
        current = next;
        continue;
      }
    }

    let body: { text: string; truncated: boolean };
    try {
      body = await readCapped(res, maxBytes);
    } catch (err) {
      if (isTimeout(err)) {
        throw new FetchError(
          "fetch_failed",
          `The site took longer than ${Math.round(timeoutMs / 1000)} seconds to respond.`,
        );
      }
      throw new FetchError("fetch_failed", `The connection to ${current.hostname} dropped while reading the page.`);
    }
    const headers: Record<string, string> = {};
    res.headers.forEach((v, k) => {
      headers[k.toLowerCase()] = v;
    });
    return {
      status: res.status,
      finalUrl: current.toString(),
      headers,
      text: body.text,
      truncated: body.truncated,
      redirects,
    };
  }
  throw new FetchError("fetch_failed", "The site redirected too many times (more than 5).");
}
