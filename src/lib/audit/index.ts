import type { AuditError, AuditReport } from "./types";
import { evaluateBots } from "./bots";
import { runChecks } from "./checks";
import type { AuditContext, LlmsInfo, RobotsInfo, SitemapInfo } from "./context";
import { createLookupCache, FetchError, normaliseUrl, safeFetch, type RequestImpl, type Resolver, type SafeFetchOptions, type SafeFetchResult } from "./fetch";
import { parsePage } from "./parse";
import { parseRobots } from "./robots";
import { scoreChecks } from "./score";

export type { AuditReport, AuditError } from "./types";

export class AuditFailure extends Error {
  code: AuditError["code"];
  constructor(code: AuditError["code"], message: string) {
    super(message);
    this.name = "AuditFailure";
    this.code = code;
  }
  toJSON(): AuditError {
    return { error: this.message, code: this.code };
  }
}

/** HTTP status the API route should use for each failure code. */
export function statusForCode(code: string): number {
  switch (code) {
    case "invalid_url":
    case "blocked_host":
      return 400;
    case "not_html":
      return 422;
    case "rate_limited":
      return 429;
    default:
      return 502;
  }
}

// ---------------------------------------------------------------------------
// Pure analysis (no network): used by runAudit and by the tests
// ---------------------------------------------------------------------------

export interface AnalyseInput {
  html: string;
  finalUrl: string;
  statusCode: number;
  headers?: Record<string, string>;
  redirects?: string[];
  truncated?: boolean;
  robots: RobotsInfo;
  llms: LlmsInfo;
  sitemap: SitemapInfo;
  warnings?: string[];
}

export function buildContext(input: AnalyseInput): AuditContext {
  const page = parsePage(input.html, input.finalUrl, input.statusCode);
  const parsedRobots = input.robots.text != null ? parseRobots(input.robots.text) : null;
  const bots = evaluateBots(parsedRobots, page.url.pathname + page.url.search);
  return {
    page,
    headers: input.headers ?? {},
    redirects: input.redirects ?? [],
    truncated: input.truncated ?? false,
    robots: input.robots,
    bots,
    llms: input.llms,
    sitemap: input.sitemap,
  };
}

export function analyse(input: AnalyseInput, requestedUrl: string, startedAt = Date.now()): AuditReport {
  const ctx = buildContext(input);
  const checks = runChecks(ctx);
  const scored = scoreChecks(checks, ctx.bots);
  const report: AuditReport = {
    url: requestedUrl,
    fetchedAt: new Date().toISOString(),
    overallScore: scored.overallScore,
    grade: scored.grade,
    verdict: scored.verdict,
    categories: scored.categories,
    fixes: scored.fixes,
    bots: ctx.bots,
    page: ctx.page.facts,
    warnings: [...(input.warnings ?? []), ...ctx.page.parseWarnings],
    durationMs: Date.now() - startedAt,
  };
  if (scored.cappedBy) report.cappedBy = scored.cappedBy;
  return report;
}

// ---------------------------------------------------------------------------
// Network side
// ---------------------------------------------------------------------------

// News homepages can ship 5+ MB of inline JSON before <body>; 2 MB cut CNN off before any text.
// Kept at 8 MB: memory is bounded by the element-count guard in parse.ts and the per-instance audit
// concurrency cap (6), so the cap does not need to drop below what real large pages need.
const PAGE_MAX_MB = 8;

/** Shared by the page fetch and the three side-file fetches of one audit: one DNS cache, one cancel signal. */
export type Net = Pick<SafeFetchOptions, "resolver" | "requestImpl" | "signal" | "lookupCache">;

export interface RunAuditOptions {
  /** Aborts the audit's network work, e.g. when the client disconnects. */
  signal?: AbortSignal;
  /** Test seams: keep tests offline. */
  resolver?: Resolver;
  requestImpl?: RequestImpl;
}

export const looksLikeHtml = (text: string) => {
  const head = text.slice(0, 600).trimStart().toLowerCase();
  return head.startsWith("<!doctype") || head.startsWith("<html") || head.includes("<head") || head.includes("<body");
};

function httpFailureMessage(status: number): string {
  if (status === 401 || status === 403) return `The site returned ${status}, so it may block automated requests.`;
  if (status === 404 || status === 410) return `The page returned ${status} (not found). Check the address and try again.`;
  if (status === 429) return "The site returned 429 and is rate limiting automated requests. Try again in a few minutes.";
  if (status >= 500) return `The site returned ${status}, which means its server reported an error.`;
  return `The site returned status ${status} instead of a normal page.`;
}

export interface RobotsFetch {
  info: RobotsInfo;
  warning?: string;
}

export async function fetchRobots(origin: string, net: Net): Promise<RobotsFetch> {
  try {
    const res = await safeFetch(`${origin}/robots.txt`, { timeoutMs: 6000, maxBytes: 512 * 1024, accept: "text/plain,*/*;q=0.5", ...net });
    if (res.status === 200) {
      if (looksLikeHtml(res.text)) {
        return {
          info: { status: "missing", httpStatus: 200, text: null, sitemaps: [] },
          warning: "robots.txt returned a web page instead of a rules file, so we treated it as missing and assumed all crawlers are allowed.",
        };
      }
      const parsed = parseRobots(res.text);
      return { info: { status: "found", httpStatus: 200, text: res.text, sitemaps: parsed.sitemaps } };
    }
    if (res.status === 401 || res.status === 403) {
      return {
        info: { status: "restricted", httpStatus: res.status, text: null, sitemaps: [] },
        warning: `robots.txt returned ${res.status}, so we assumed all crawlers are allowed. Bot protection can block our request while allowing real search crawlers, so the real result may differ.`,
      };
    }
    if (res.status >= 500) {
      return {
        info: { status: "error", httpStatus: res.status, text: null, sitemaps: [] },
        warning: `robots.txt returned a server error (${res.status}), so we assumed all crawlers are allowed.`,
      };
    }
    return { info: { status: "missing", httpStatus: res.status, text: null, sitemaps: [] } };
  } catch (err) {
    return {
      info: { status: "error", text: null, sitemaps: [] },
      warning: `Could not read robots.txt (${err instanceof FetchError ? err.message : "request failed"}), so we assumed all crawlers are allowed.`,
    };
  }
}

export async function fetchLlms(origin: string, net: Net): Promise<LlmsInfo> {
  try {
    const res = await safeFetch(`${origin}/llms.txt`, { timeoutMs: 5000, maxBytes: 256 * 1024, accept: "text/plain,text/markdown,*/*;q=0.5", ...net });
    if (res.status !== 200) return { found: false, httpStatus: res.status, note: `/llms.txt returned ${res.status}` };
    const type = (res.headers["content-type"] ?? "").toLowerCase();
    if (type.includes("html") || looksLikeHtml(res.text)) {
      return { found: false, httpStatus: 200, note: `/llms.txt returned a web page (probably the site's 404 page), not a text file` };
    }
    if (!res.text.trim()) return { found: false, httpStatus: 200, note: "/llms.txt is empty" };
    return { found: true, httpStatus: 200 };
  } catch (err) {
    return { found: false, note: `Could not fetch llms.txt (${err instanceof FetchError ? err.message : "request failed"})` };
  }
}

async function probeSitemap(origin: string, net: Net): Promise<SitemapInfo> {
  const candidates: { path: "/sitemap.xml" | "/sitemap_index.xml" }[] = [{ path: "/sitemap.xml" }, { path: "/sitemap_index.xml" }];
  const results = await Promise.all(
    candidates.map(async (c): Promise<SitemapInfo> => {
      try {
        const res: SafeFetchResult = await safeFetch(`${origin}${c.path}`, { timeoutMs: 5000, maxBytes: 128 * 1024, accept: "application/xml,text/xml,*/*;q=0.5", ...net });
        const head = res.text.slice(0, 400).trimStart().toLowerCase();
        const xmlish = (res.headers["content-type"] ?? "").toLowerCase().includes("xml") || head.startsWith("<?xml") || head.startsWith("<urlset") || head.startsWith("<sitemapindex");
        if (res.status === 200 && xmlish && !looksLikeHtml(res.text)) return { found: true, url: res.finalUrl, via: c.path };
      } catch {
        /* treat as not found */
      }
      return { found: false };
    }),
  );
  return results.find((r) => r.found) ?? { found: false };
}

/** Fetch one page and require a normal HTML answer. Throws AuditFailure; shared by single audits and the multi-page audit. */
export async function fetchHtmlPage(url: URL, net: Net, limits: { maxBytes?: number; timeoutMs?: number } = {}): Promise<SafeFetchResult> {
  let page: SafeFetchResult;
  try {
    page = await safeFetch(url, { maxBytes: limits.maxBytes ?? PAGE_MAX_MB * 1024 * 1024, timeoutMs: limits.timeoutMs, ...net });
  } catch (err) {
    if (err instanceof FetchError) throw new AuditFailure(err.code, err.message);
    throw new AuditFailure("fetch_failed", "We could not fetch that page.");
  }

  if (page.status >= 400 || page.status < 200) {
    throw new AuditFailure("fetch_failed", httpFailureMessage(page.status));
  }
  const type = (page.headers["content-type"] ?? "").toLowerCase();
  const htmlType = type.includes("html") || type.includes("xhtml");
  if (!htmlType && !(type === "" && looksLikeHtml(page.text)) && !(type.startsWith("text/plain") && looksLikeHtml(page.text))) {
    // Fixed wording: the content type is chosen by the target site, so it is not echoed back.
    throw new AuditFailure("not_html", "That address did not return an HTML page. Enter the address of a web page.");
  }

  return page;
}

export async function runAudit(inputUrl: string, opts: RunAuditOptions = {}): Promise<AuditReport> {
  const startedAt = Date.now();
  let url: URL;
  try {
    url = normaliseUrl(inputUrl);
  } catch (err) {
    if (err instanceof FetchError) throw new AuditFailure(err.code, err.message);
    throw err;
  }

  const net: Net = { resolver: opts.resolver, requestImpl: opts.requestImpl, signal: opts.signal, lookupCache: createLookupCache() };
  const page = await fetchHtmlPage(url, net);

  const origin = new URL(page.finalUrl).origin;
  const [robotsR, llmsR, sitemapR] = await Promise.allSettled([fetchRobots(origin, net), fetchLlms(origin, net), probeSitemap(origin, net)]);

  const warnings: string[] = [];
  let robots: RobotsInfo;
  if (robotsR.status === "fulfilled") {
    robots = robotsR.value.info;
    if (robotsR.value.warning) warnings.push(robotsR.value.warning);
  } else {
    robots = { status: "error", text: null, sitemaps: [] };
    warnings.push("Could not read robots.txt, so we assumed all crawlers are allowed.");
  }
  const llms: LlmsInfo = llmsR.status === "fulfilled" ? llmsR.value : { found: false, note: "llms.txt check failed" };
  let sitemap: SitemapInfo;
  if (robots.sitemaps.length) {
    sitemap = { found: true, url: robots.sitemaps[0], via: "robots.txt" };
  } else if (sitemapR.status === "fulfilled") {
    sitemap = sitemapR.value;
  } else {
    sitemap = { found: false };
  }

  if (page.truncated) {
    warnings.push(`The page HTML is larger than ${PAGE_MAX_MB} MB, so only the first ${PAGE_MAX_MB} MB was analysed and some checks may undercount.`);
  }
  if (page.redirects.length) warnings.push(`The address redirected ${page.redirects.length} time${page.redirects.length === 1 ? "" : "s"}; results are for ${page.finalUrl}.`);

  return analyse(
    {
      html: page.text,
      finalUrl: page.finalUrl,
      statusCode: page.status,
      headers: page.headers,
      redirects: page.redirects,
      truncated: page.truncated,
      robots,
      llms,
      sitemap,
      warnings,
    },
    url.toString(),
    startedAt,
  );
}
