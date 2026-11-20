import { lookup as dnsLookup } from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import { Readable, type Transform } from "node:stream";
import zlib from "node:zlib";

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

export interface ResolvedAddress {
  address: string;
  family: number;
}
export type Resolver = (hostname: string) => Promise<ResolvedAddress[]>;

const defaultResolver: Resolver = (hostname) => dnsLookup(hostname, { all: true });

/** Per-lookup ceiling. dns.lookup runs on the libuv threadpool and cannot be aborted. */
const LOOKUP_TIMEOUT_MS = 3_000;

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
// SSRF guard: address classification
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
  ["0.0.0.0", 8], // "this network"
  ["10.0.0.0", 8],
  ["100.64.0.0", 10], // carrier-grade NAT
  ["127.0.0.0", 8],
  ["169.254.0.0", 16], // link-local, cloud metadata
  ["172.16.0.0", 12],
  ["192.0.0.0", 24], // IETF protocol assignments
  ["192.0.2.0", 24], // documentation
  ["192.88.99.0", 24], // deprecated 6to4 relay anycast
  ["192.168.0.0", 16],
  ["198.18.0.0", 15], // benchmarking
  ["198.51.100.0", 24], // documentation
  ["203.0.113.0", 24], // documentation
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // reserved
  ["255.255.255.255", 32], // broadcast (also inside 240/4; listed explicitly)
  ["168.63.129.16", 32], // Azure wireserver
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

const v4From = (hi: number, lo: number) => `${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`;

function isBlockedV6(ip: string): boolean {
  const g = expandV6(ip);
  if (!g) return true;
  const zeros = (from: number, to: number) => g.slice(from, to).every((x) => x === 0);
  if (zeros(0, 7) && (g[7] === 0 || g[7] === 1)) return true; // :: and ::1
  // ::ffff:0:0/96 (IPv4-mapped) and ::/96 (IPv4-compatible): judge the embedded IPv4
  if (zeros(0, 5) && (g[5] === 0xffff || g[5] === 0)) return isBlockedV4(v4From(g[6], g[7]));
  // ::ffff:0:0:0/96 (SIIT translated): judge the embedded IPv4
  if (zeros(0, 4) && g[4] === 0xffff && g[5] === 0) return isBlockedV4(v4From(g[6], g[7]));
  // 64:ff9b::/96 NAT64 well-known prefix: judge the embedded IPv4
  if (g[0] === 0x64 && g[1] === 0xff9b && zeros(2, 6)) return isBlockedV4(v4From(g[6], g[7]));
  // 64:ff9b:1::/48 local-use NAT64: no public meaning, block
  if (g[0] === 0x64 && g[1] === 0xff9b && g[2] === 1) return true;
  if (g[0] === 0x100 && zeros(1, 4)) return true; // 100::/64 discard-only
  if (g[0] === 0x2001 && g[1] === 0) return true; // 2001::/32 Teredo
  if (g[0] === 0x2001 && g[1] === 0x0db8) return true; // 2001:db8::/32 documentation
  if (g[0] === 0x2002) return isBlockedV4(v4From(g[1], g[2])); // 2002::/16 6to4: embedded IPv4
  if ((g[0] & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
  if ((g[0] & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((g[0] & 0xff00) === 0xff00) return true; // ff00::/8 multicast
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

const BLOCKED_SUFFIXES = [
  ".localhost",
  ".local",
  ".internal",
  ".intranet",
  ".corp",
  ".private",
  ".localdomain",
  ".lan",
  ".home.arpa",
];

function isBlockedHostname(host: string): boolean {
  const h = host.toLowerCase().replace(/\.$/, "");
  return h === "localhost" || h === "metadata.google.internal" || BLOCKED_SUFFIXES.some((s) => h.endsWith(s));
}

const BLOCKED_MSG = "That address points at a private or internal host, so it cannot be checked.";

// ---------------------------------------------------------------------------
// SSRF guard: URL checks and bounded, cached, validated resolution
// ---------------------------------------------------------------------------

/** Per-audit cache of hostname -> in-flight/finished resolution. Entries are re-validated on every use. */
export type LookupCache = Map<string, Promise<ResolvedAddress[]>>;
export const createLookupCache = (): LookupCache => new Map();

export interface GuardOptions {
  resolver?: Resolver;
  /** Aborts waiting for DNS when the overall request deadline passes or the client leaves. */
  signal?: AbortSignal;
  lookupTimeoutMs?: number;
  cache?: LookupCache;
}

/** One message for "does not resolve" and "resolves to a private address", so error text cannot map internal DNS. */
const unreachableMessage = (host: string) => `We could not reach a public website at ${host}. Check the address.`;

function raceAbort<T>(p: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return p;
  if (signal.aborted) {
    p.catch(() => undefined);
    return Promise.reject(signal.reason);
  }
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(signal.reason);
    signal.addEventListener("abort", onAbort, { once: true });
    p.then(
      (v) => {
        signal.removeEventListener("abort", onAbort);
        resolve(v);
      },
      (e) => {
        signal.removeEventListener("abort", onAbort);
        reject(e);
      },
    );
  });
}

function boundedResolve(host: string, resolver: Resolver, timeoutMs: number): Promise<ResolvedAddress[]> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new FetchError("fetch_failed", unreachableMessage(host))), timeoutMs);
    resolver(host).then(
      (a) => {
        clearTimeout(timer);
        resolve(a);
      },
      () => {
        clearTimeout(timer);
        reject(new FetchError("fetch_failed", unreachableMessage(host)));
      },
    );
  });
}

/**
 * Static checks (scheme, credentials, port, hostname deny-list, IP literals). Returns the bare host.
 *
 * Port policy: only 80 and 443 are allowed. Other ports are where internal admin panels, databases,
 * dev servers and metadata sidecars live, and letting an anonymous caller choose the port would turn
 * this tool into a port scanner (open, closed and filtered ports give different errors and timings).
 */
export function assertSafeUrlSyntax(url: URL): string {
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
  if (isBlockedHostname(host)) throw new FetchError("blocked_host", BLOCKED_MSG);
  if (net.isIP(host) && isBlockedIp(host)) throw new FetchError("blocked_host", BLOCKED_MSG);
  return host;
}

/**
 * Validate `url` and return the addresses a connection may use. Hostnames are resolved once (bounded by a
 * per-lookup timeout and the caller's deadline), and the request is later pinned to exactly these addresses.
 * Rejects when ANY resolved address is non-public.
 */
export async function resolveSafeAddresses(url: URL, opts: GuardOptions = {}): Promise<ResolvedAddress[]> {
  const host = assertSafeUrlSyntax(url);
  const kind = net.isIP(host);
  if (kind) return [{ address: host, family: kind }];

  const key = host.toLowerCase();
  let pending = opts.cache?.get(key);
  if (!pending) {
    pending = boundedResolve(host, opts.resolver ?? defaultResolver, opts.lookupTimeoutMs ?? LOOKUP_TIMEOUT_MS);
    if (opts.cache) {
      opts.cache.set(key, pending);
      const cache = opts.cache;
      pending.catch(() => cache.delete(key));
    }
  }
  const addrs = await raceAbort(pending, opts.signal);
  if (!addrs.length || addrs.some((a) => isBlockedIp(a.address))) {
    throw new FetchError("fetch_failed", unreachableMessage(host));
  }
  return addrs;
}

/** Throws FetchError unless `url` is a public http(s) address on port 80/443. */
export async function assertSafeUrl(url: URL, resolver?: Resolver, opts: Omit<GuardOptions, "resolver"> = {}): Promise<void> {
  await resolveSafeAddresses(url, { ...opts, resolver });
}

// ---------------------------------------------------------------------------
// Transport
// ---------------------------------------------------------------------------

type LookupCallback = (err: NodeJS.ErrnoException | null, address?: string | ResolvedAddress[], family?: number) => void;
export type PinnedLookup = (hostname: string, options: unknown, callback: LookupCallback) => void;

export interface TransportRequest {
  url: URL;
  headers: Record<string, string>;
  signal: AbortSignal;
  /** The ONLY way the connection may turn the hostname into an address. */
  lookup: PinnedLookup;
}
export interface TransportResponse {
  status: number;
  headers: Record<string, string | string[] | undefined>;
  body: Readable;
}
export type RequestImpl = (req: TransportRequest) => Promise<TransportResponse>;

/**
 * Build a `lookup` for http(s).request that hands the socket the already validated addresses.
 * Check and connect cannot diverge because there is no second DNS resolution.
 * Handles both call shapes: `{ all: true }` (happy eyeballs) and the single-address form.
 */
export function makePinnedLookup(expectedHost: string, resolveValidated: () => Promise<ResolvedAddress[]>): PinnedLookup {
  return (hostname, options, callback) => {
    const opts = (typeof options === "object" && options !== null ? options : { family: typeof options === "number" ? options : 0 }) as {
      all?: boolean;
      family?: number | string;
    };
    const fail = (err: unknown) => callback(err instanceof Error ? (err as NodeJS.ErrnoException) : new Error("lookup failed"));
    if (hostname.toLowerCase() !== expectedHost.toLowerCase()) {
      fail(Object.assign(new Error(`unexpected lookup for ${hostname}`), { code: "ENOTFOUND" }));
      return;
    }
    resolveValidated().then((addrs) => {
      const want = opts.family === 4 || opts.family === "IPv4" ? 4 : opts.family === 6 || opts.family === "IPv6" ? 6 : 0;
      const usable = want ? addrs.filter((a) => a.family === want) : addrs;
      if (!usable.length) {
        fail(Object.assign(new Error("no usable address"), { code: "ENOTFOUND" }));
        return;
      }
      if (opts.all) callback(null, usable.map((a) => ({ address: a.address, family: a.family })));
      else callback(null, usable[0].address, usable[0].family);
    }, fail);
  };
}

const nodeRequest: RequestImpl = (req) =>
  new Promise((resolve, reject) => {
    const { url } = req;
    const secure = url.protocol === "https:";
    const host = url.hostname.replace(/^\[|\]$/g, "");
    const r = (secure ? https : http).request(
      {
        hostname: host, // Host header and TLS name stay the original hostname
        port: url.port || (secure ? 443 : 80),
        path: url.pathname + url.search,
        method: "GET",
        headers: req.headers,
        agent: false,
        lookup: req.lookup as unknown as net.LookupFunction,
        servername: secure && !net.isIP(host) ? host : undefined, // SNI + certificate check use the hostname
        signal: req.signal,
      },
      (res) => resolve({ status: res.statusCode ?? 0, headers: res.headers, body: res }),
    );
    r.on("error", reject);
    r.end();
  });

// ---------------------------------------------------------------------------
// Safe fetch
// ---------------------------------------------------------------------------

export interface SafeFetchOptions {
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
  accept?: string;
  resolver?: Resolver;
  /** Override for tests (replaces the node:http/https transport). */
  requestImpl?: RequestImpl;
  /** Extra cancellation, e.g. the incoming request's signal. */
  signal?: AbortSignal;
  /** Share across the fetches of one audit so each hostname is resolved once. */
  lookupCache?: LookupCache;
  lookupTimeoutMs?: number;
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

function decoderFor(contentType: string | null | undefined): TextDecoder {
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

function isAbortLike(err: unknown): boolean {
  return err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError" || (err as { code?: string }).code === "ABORT_ERR");
}

function decompressor(encoding: string): Transform | null {
  switch (encoding.trim().toLowerCase()) {
    case "gzip":
    case "x-gzip":
      return zlib.createGunzip();
    case "deflate":
      return zlib.createInflate();
    case "br":
      return zlib.createBrotliDecompress();
    default:
      return null;
  }
}

/** Read the (decompressed) body, applying the byte cap to the DECOMPRESSED stream. */
async function readCapped(
  res: TransportResponse,
  maxBytes: number,
  signal: AbortSignal,
): Promise<{ text: string; truncated: boolean }> {
  const encoding = String(res.headers["content-encoding"] ?? "");
  const dec = encoding ? decompressor(encoding) : null;
  let stream: Readable = res.body;
  if (dec) {
    res.body.on("error", (e) => dec.destroy(e));
    res.body.pipe(dec);
    stream = dec;
  }
  const onAbort = () => {
    const reason = signal.reason ?? new Error("aborted");
    res.body.destroy(reason);
    dec?.destroy(reason);
  };
  signal.addEventListener("abort", onAbort, { once: true });
  const chunks: Uint8Array[] = [];
  let total = 0;
  let truncated = false;
  try {
    for await (const chunk of stream as AsyncIterable<Uint8Array>) {
      const value = chunk instanceof Uint8Array ? chunk : Buffer.from(chunk as unknown as string);
      if (total + value.byteLength > maxBytes) {
        chunks.push(value.subarray(0, maxBytes - total));
        total = maxBytes;
        truncated = true;
        break;
      }
      chunks.push(value);
      total += value.byteLength;
    }
  } finally {
    signal.removeEventListener("abort", onAbort);
    res.body.destroy();
    dec?.destroy();
  }
  const buf = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    buf.set(c, off);
    off += c.byteLength;
  }
  const ct = res.headers["content-type"];
  return { text: decoderFor(Array.isArray(ct) ? ct[0] : ct).decode(buf), truncated };
}

const headerString = (v: string | string[] | undefined): string | null => (v === undefined ? null : Array.isArray(v) ? v.join(", ") : v);

export async function safeFetch(input: string | URL, opts: SafeFetchOptions = {}): Promise<SafeFetchResult> {
  const timeoutMs = opts.timeoutMs ?? 10_000;
  const maxBytes = opts.maxBytes ?? 2 * 1024 * 1024;
  const maxRedirects = opts.maxRedirects ?? 5;
  const doRequest = opts.requestImpl ?? nodeRequest;
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  const signal = opts.signal ? AbortSignal.any([timeoutSignal, opts.signal]) : timeoutSignal;
  const cache = opts.lookupCache ?? createLookupCache();

  let current = typeof input === "string" ? normaliseUrl(input) : new URL(input.toString());
  const originalHost = current.hostname;
  // Redirect targets are controlled by the site, so never echo their hostname back to the user.
  const label = (u: URL) => (u.hostname === originalHost ? u.hostname : "the address it redirected to");
  const redirects: string[] = [];

  const timeoutError = () =>
    opts.signal?.aborted && !timeoutSignal.aborted
      ? new FetchError("fetch_failed", "The check was cancelled.")
      : new FetchError("fetch_failed", `The site took longer than ${Math.round(timeoutMs / 1000)} seconds to respond.`);

  for (let hop = 0; hop <= maxRedirects; hop++) {
    const guardOpts: GuardOptions = { resolver: opts.resolver, signal, lookupTimeoutMs: opts.lookupTimeoutMs, cache };
    try {
      await resolveSafeAddresses(current, guardOpts);
    } catch (err) {
      if (err instanceof FetchError) throw err;
      if (isAbortLike(err)) throw timeoutError();
      throw new FetchError("fetch_failed", `We could not connect to ${label(current)}.`);
    }

    const hopUrl = current;
    let res: TransportResponse;
    try {
      res = await raceAbort(
        doRequest({
          url: hopUrl,
          signal,
          lookup: makePinnedLookup(hopUrl.hostname.replace(/^\[|\]$/g, ""), () => resolveSafeAddresses(hopUrl, guardOpts)),
          headers: {
            "User-Agent": USER_AGENT,
            Accept: opts.accept ?? "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en",
            "Accept-Encoding": "gzip, deflate, br",
          },
        }),
        signal,
      );
    } catch (err) {
      if (err instanceof FetchError) throw err;
      if (isAbortLike(err)) throw timeoutError();
      const inner = (err as { cause?: unknown })?.cause;
      if (inner instanceof FetchError) throw inner;
      throw new FetchError("fetch_failed", `We could not connect to ${label(hopUrl)}.`);
    }

    if (REDIRECT_CODES.has(res.status)) {
      const location = headerString(res.headers["location"]);
      res.body.destroy();
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
      body = await readCapped(res, maxBytes, signal);
    } catch (err) {
      if (isAbortLike(err) || signal.aborted) throw timeoutError();
      throw new FetchError("fetch_failed", `The connection to ${label(hopUrl)} dropped while reading the page.`);
    }
    const headers: Record<string, string> = {};
    for (const [k, v] of Object.entries(res.headers)) {
      const s = headerString(v);
      if (s !== null) headers[k.toLowerCase()] = s;
    }
    // The body has been decoded, so these no longer describe what we hold.
    delete headers["content-encoding"];
    delete headers["content-length"];
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
