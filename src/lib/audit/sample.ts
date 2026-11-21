import { assertSafeUrlSyntax, FetchError } from "./fetch";
import { siteKey } from "./sitemap";

export const SAMPLE_SIZE = 40;

/** Extensions that are clearly not HTML pages. Paths with no extension, or .html/.php style ones, are kept. */
const PAGE_EXTENSION = /\.(?:html?|xhtml|php\d?|aspx?|jsp|cfm|shtml)$/i;
const ANY_EXTENSION = /\.[a-z0-9]{1,8}$/i;

/** Canonical form used for dedupe: no fragment, no trailing slash except at the root. */
function canonical(url: URL): string {
  const copy = new URL(url.href);
  copy.hash = "";
  if (copy.pathname.length > 1) copy.pathname = copy.pathname.replace(/\/+$/, "") || "/";
  return copy.href;
}

/** Same rules as the fetcher (scheme, port, hostname deny-list), so unfetchable addresses never take a sample slot. */
function fetchable(url: URL): boolean {
  try {
    assertSafeUrlSyntax(url);
    return true;
  } catch (err) {
    if (err instanceof FetchError) return false;
    throw err;
  }
}

function looksLikePage(url: URL): boolean {
  const last = url.pathname.split("/").pop() ?? "";
  return !ANY_EXTENSION.test(last) || PAGE_EXTENSION.test(last);
}

/**
 * The page type a path belongs to: "/" for the home page, "/*" for single-segment pages such as /about,
 * and "/blog/*" for everything under /blog. First path segment only, so the grouping stays predictable.
 */
export function templateOf(url: URL): string {
  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length === 0) return "/";
  if (segments.length === 1) return "/*";
  return `/${segments[0].toLowerCase()}/*`;
}

/**
 * Choose up to `size` pages: the address the user gave first, then round-robin across page types so one big
 * section (a blog with 3,000 posts) cannot crowd out the rest. Inside a type the picks are evenly spaced.
 * Deterministic: the same sitemap gives the same sample.
 */
export function pickSample(input: URL, candidates: string[], size = SAMPLE_SIZE): URL[] {
  const site = siteKey(input.hostname);
  const seen = new Set<string>();
  const chosen: URL[] = [];
  const first = new URL(input.href);
  first.hash = "";
  seen.add(canonical(first));
  chosen.push(first);

  const groups = new Map<string, URL[]>();
  for (const raw of candidates) {
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      continue;
    }
    if (siteKey(url.hostname) !== site || !fetchable(url) || !looksLikePage(url)) continue;
    const key = canonical(url);
    if (seen.has(key)) continue;
    seen.add(key);
    const template = templateOf(url);
    const list = groups.get(template);
    if (list) list.push(url);
    else groups.set(template, [url]);
  }

  // Largest types first; ties keep first-seen order (Map order), so the result is repeatable.
  const queues = [...groups.values()]
    .sort((a, b) => b.length - a.length)
    .map((list) => evenlySpaced(list, Math.min(list.length, size)));
  for (let round = 0; chosen.length < size; round++) {
    let tookAny = false;
    for (const queue of queues) {
      if (round < queue.length && chosen.length < size) {
        chosen.push(queue[round]);
        tookAny = true;
      }
    }
    if (!tookAny) break;
  }
  return chosen;
}

function evenlySpaced<T>(list: T[], count: number): T[] {
  if (count >= list.length) return list;
  return Array.from({ length: count }, (_, i) => list[Math.floor((i * list.length) / count)]);
}
