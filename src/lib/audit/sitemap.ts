import { safeFetch } from "./fetch";
import { looksLikeHtml, type Net } from "./index";

/** Caps on a site-controlled input: a hostile sitemap must not cost unbounded bytes, requests or memory. */
export const SITEMAP_LIMITS = {
  /** Decompressed bytes read per sitemap file. */
  maxBytes: 2 * 1024 * 1024,
  /** Sitemap files read in one run, counting the roots and the children of an index. */
  maxFiles: 6,
  /** Page addresses kept across all files. */
  maxUrls: 5000,
  /** Characters in one address. */
  maxUrlLength: 1024,
  timeoutMs: 6000,
} as const;

/** Two hostnames count as one site when they match once a leading "www." is removed. */
export function siteKey(hostname: string): string {
  return hostname.toLowerCase().replace(/\.$/, "").replace(/^www\./, "");
}

export interface ParsedSitemap {
  kind: "index" | "urlset";
  locs: string[];
  /** True when more <loc> entries existed than `limit`. */
  capped: boolean;
}

const decodeXml = (s: string) =>
  s
    .replace(/^<!\[CDATA\[([\s\S]*?)\]\]>$/, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");

// The character class excludes "<", so this cannot backtrack across tags: linear in the input size.
const LOC = /<loc>\s*([^<]{1,2048}?)\s*<\/loc>/gi;

/** Pull <loc> entries out of a sitemap or sitemap index. Regex rather than a DOM so a huge file stays cheap. */
export function parseSitemapXml(xml: string, limit: number): ParsedSitemap {
  const kind = /<sitemapindex[\s>]/i.test(xml.slice(0, 2000)) ? "index" : "urlset";
  const locs: string[] = [];
  let capped = false;
  for (const m of xml.matchAll(LOC)) {
    if (locs.length >= limit) {
      capped = true;
      break;
    }
    locs.push(decodeXml(m[1]));
  }
  return { kind, locs, capped };
}

/** Parse `raw` and keep it only when it is a web address on the audited site. Gzipped files are skipped (see discover). */
function sameSiteUrl(raw: string, site: string): URL | null {
  if (raw.length > SITEMAP_LIMITS.maxUrlLength) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (url.username || url.password) return null;
  if (siteKey(url.hostname) !== site) return null;
  return url;
}

export interface SitemapDiscovery {
  urls: string[];
  found: boolean;
  /** The first root sitemap file that was read (not a child of an index). */
  url?: string;
  filesRead: number;
  notes: string[];
}

/**
 * Read the site's sitemap: the `Sitemap:` lines from robots.txt, else /sitemap.xml and /sitemap_index.xml.
 * Follows one level of sitemap index. Every file goes through safeFetch (SSRF guard, pinned DNS, redirect
 * re-validation), and only addresses on the audited site are fetched or returned, so a sitemap cannot steer us
 * at another host or at a private address.
 * .gz sitemap files are skipped: the fetch layer inflates a Content-Encoding body but not a gzip file.
 */
export async function discoverSitemapUrls(site: URL, robotsSitemaps: string[], net: Net): Promise<SitemapDiscovery> {
  const key = siteKey(site.hostname);
  const notes: string[] = [];
  let filesRead = 0;
  let droppedOffSite = 0;
  let skippedGz = 0;

  const accept = (raw: string): URL | null => {
    const url = sameSiteUrl(raw, key);
    if (!url) {
      droppedOffSite++;
      return null;
    }
    if (/\.gz$/i.test(url.pathname)) {
      skippedGz++;
      return null;
    }
    return url;
  };

  const readFile = async (url: URL): Promise<ParsedSitemap | null> => {
    if (filesRead >= SITEMAP_LIMITS.maxFiles) return null;
    filesRead++;
    try {
      const res = await safeFetch(url, { timeoutMs: SITEMAP_LIMITS.timeoutMs, maxBytes: SITEMAP_LIMITS.maxBytes, accept: "application/xml,text/xml,*/*;q=0.5", ...net });
      const head = res.text.slice(0, 400).trimStart().toLowerCase();
      const xmlish = (res.headers["content-type"] ?? "").toLowerCase().includes("xml") || head.startsWith("<?xml") || head.startsWith("<urlset") || head.startsWith("<sitemapindex");
      if (res.status !== 200 || !xmlish || looksLikeHtml(res.text)) return null;
      if (res.truncated) notes.push("A sitemap file was larger than 2 MB, so only its first part was read.");
      return parseSitemapXml(res.text, SITEMAP_LIMITS.maxUrls);
    } catch {
      return null;
    }
  };

  const rootCandidates = robotsSitemaps.length ? robotsSitemaps : ["/sitemap.xml", "/sitemap_index.xml"].map((p) => new URL(p, site.origin).href);
  const roots: URL[] = [];
  for (const raw of rootCandidates) {
    const url = accept(raw);
    if (url && !roots.some((r) => r.href === url.href)) roots.push(url);
    if (roots.length >= 3) break;
  }

  const urls: string[] = [];
  let found = false;
  let firstUrl: string | undefined;
  const take = (parsed: ParsedSitemap) => {
    for (const loc of parsed.locs) {
      const url = accept(loc);
      if (url && urls.length < SITEMAP_LIMITS.maxUrls) urls.push(url.href);
    }
    if (parsed.capped || urls.length >= SITEMAP_LIMITS.maxUrls) notes.push("The sitemap lists more than 5,000 addresses, so only the first 5,000 were considered.");
  };

  const parsedRoots = await Promise.all(roots.map(readFile));
  const children: URL[] = [];
  for (const [i, parsed] of parsedRoots.entries()) {
    if (!parsed) continue;
    found = true;
    firstUrl ??= roots[i].href;
    if (parsed.kind === "urlset") {
      take(parsed);
      continue;
    }
    for (const loc of parsed.locs) {
      const child = accept(loc);
      if (child) children.push(child);
    }
  }

  // One level only: a sitemap listed inside a child sitemap is not followed.
  const parsedChildren = await Promise.all(children.slice(0, SITEMAP_LIMITS.maxFiles).map(readFile));
  for (const parsed of parsedChildren) {
    if (parsed?.kind === "urlset") take(parsed);
  }
  if (children.length > SITEMAP_LIMITS.maxFiles) notes.push("The sitemap index lists many sitemap files, so only the first few were read.");

  if (droppedOffSite) notes.push(`Ignored ${droppedOffSite} sitemap ${droppedOffSite === 1 ? "address" : "addresses"} that belong to a different site.`);
  if (skippedGz) notes.push("Compressed (.gz) sitemap files were skipped.");
  return { urls: [...new Set(urls)], found, url: firstUrl, filesRead, notes };
}
