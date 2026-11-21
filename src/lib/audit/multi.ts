import { AuditFailure, analyse, fetchHtmlPage, fetchLlms, fetchRobots } from "./index";
import type { Net } from "./index";
import { createLookupCache, FetchError, normaliseUrl } from "./fetch";
import type { RequestImpl, Resolver } from "./fetch";
import type { LlmsInfo, RobotsInfo, SitemapInfo } from "./context";
import { pickSample, SAMPLE_SIZE, templateOf } from "./sample";
import { gradeFor } from "./score";
import { discoverSitemapUrls, siteKey } from "./sitemap";
import { mapPool } from "./slots";
import type { AuditReport } from "./types";
import type { CheckPattern, SiteFix, SitePage, SiteReport, TemplateSummary } from "./wide-types";

/** The route allows 60 s; the last 5 s are for aggregating and sending the answer. */
export const SITE_DEADLINE_MS = 55_000;
export const SITE_MAX_PARALLEL = 4;
/** Sampled pages are read with tighter limits than a single audit, because up to four are in memory at once. */
const SITE_PAGE_MAX_BYTES = 3 * 1024 * 1024;
const SITE_PAGE_TIMEOUT_MS = 8_000;
const TOP_FIXES = 5;
const FAILED_PAGES_SHOWN = 10;

export interface RunSiteAuditOptions {
  signal?: AbortSignal;
  /** Test seams: keep tests offline. */
  resolver?: Resolver;
  requestImpl?: RequestImpl;
  deadlineMs?: number;
  /** At most SITE_MAX_PARALLEL. */
  concurrency?: number;
  sampleSize?: number;
}

interface PageOutcome {
  url: string;
  template: string;
  report?: AuditReport;
  failure?: { code: string; message: string };
}

const average = (nums: number[]) => (nums.length ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length) : 0);

/** Group the per-page reports into what the site owner needs: page types, repeated problems, common fixes. */
export function summarise(outcomes: PageOutcome[]): Pick<SiteReport, "templates" | "patterns" | "topFixes" | "pages" | "averageScore" | "grade"> {
  const done = outcomes.filter((o): o is PageOutcome & { report: AuditReport } => Boolean(o.report));

  const scoresByTemplate = new Map<string, number[]>();
  for (const o of done) scoresByTemplate.set(o.template, [...(scoresByTemplate.get(o.template) ?? []), o.report.overallScore]);
  const templates: TemplateSummary[] = [...scoresByTemplate.entries()]
    .map(([template, scores]) => ({ template, pages: scores.length, averageScore: average(scores) }))
    .sort((a, b) => b.pages - a.pages || a.template.localeCompare(b.template));

  const patterns = new Map<string, CheckPattern>();
  for (const o of done) {
    for (const category of o.report.categories) {
      for (const check of category.checks) {
        if (check.status !== "fail" && check.status !== "warn") continue;
        let p = patterns.get(check.id);
        if (!p) {
          p = { checkId: check.id, title: check.title, category: check.category, worst: "warn", failing: 0, warning: 0, byTemplate: [] };
          patterns.set(check.id, p);
        }
        let t = p.byTemplate.find((x) => x.template === o.template);
        if (!t) {
          t = { template: o.template, pages: scoresByTemplate.get(o.template)?.length ?? 0, failing: 0, warning: 0 };
          p.byTemplate.push(t);
        }
        if (check.status === "fail") {
          p.failing++;
          t.failing++;
          p.worst = "fail";
        } else {
          p.warning++;
          t.warning++;
        }
      }
    }
  }
  const affected = (x: { failing: number; warning: number }) => x.failing + x.warning;
  const sortedPatterns = [...patterns.values()]
    .map((p) => ({ ...p, byTemplate: [...p.byTemplate].sort((a, b) => affected(b) - affected(a) || a.template.localeCompare(b.template)) }))
    .sort((a, b) => affected(b) - affected(a) || b.failing - a.failing || a.checkId.localeCompare(b.checkId));

  const fixes = new Map<string, SiteFix & { priority: number }>();
  for (const o of done) {
    for (const fix of o.report.fixes) {
      const seen = fixes.get(fix.checkId);
      if (seen) {
        seen.pagesAffected++;
        seen.priority += fix.priority;
      } else {
        fixes.set(fix.checkId, {
          checkId: fix.checkId,
          title: fix.title,
          category: fix.category,
          why: fix.why,
          how: fix.how,
          impact: fix.impact,
          effort: fix.effort,
          pagesAffected: 1,
          priority: fix.priority,
        });
      }
    }
  }
  const topFixes: SiteFix[] = [...fixes.values()]
    .sort((a, b) => b.pagesAffected - a.pagesAffected || b.priority - a.priority || a.checkId.localeCompare(b.checkId))
    .slice(0, TOP_FIXES)
    .map((fix) => ({
      checkId: fix.checkId,
      title: fix.title,
      category: fix.category,
      why: fix.why,
      how: fix.how,
      impact: fix.impact,
      effort: fix.effort,
      pagesAffected: fix.pagesAffected,
    }));

  const pages: SitePage[] = done.map((o) => ({ url: o.report.url, template: o.template, score: o.report.overallScore, grade: o.report.grade }));
  const averageScore = average(done.map((o) => o.report.overallScore));
  return { templates, patterns: sortedPatterns, topFixes, pages, averageScore, grade: gradeFor(averageScore) };
}

/**
 * Audit a sample of pages from one site. robots.txt and llms.txt are fetched once for the whole run, the DNS cache
 * is shared, and every request goes through the pinned, SSRF-guarded fetcher. When the deadline passes, pages not
 * yet finished are dropped and the result is returned as partial.
 */
export async function runSiteAudit(inputUrl: string, opts: RunSiteAuditOptions = {}): Promise<SiteReport> {
  const startedAt = Date.now();
  let input: URL;
  try {
    input = normaliseUrl(inputUrl);
  } catch (err) {
    if (err instanceof FetchError) throw new AuditFailure(err.code, err.message);
    throw err;
  }

  const deadline = AbortSignal.timeout(opts.deadlineMs ?? SITE_DEADLINE_MS);
  const signal = opts.signal ? AbortSignal.any([opts.signal, deadline]) : deadline;
  const net: Net = { resolver: opts.resolver, requestImpl: opts.requestImpl, signal, lookupCache: createLookupCache() };

  const [robotsR, llmsR] = await Promise.all([fetchRobots(input.origin, net), fetchLlms(input.origin, net)]);
  const robots: RobotsInfo = robotsR.info;
  const llms: LlmsInfo = llmsR;
  const discovery = await discoverSitemapUrls(input, robots.sitemaps, net);
  const sitemap: SitemapInfo = discovery.found
    ? { found: true, url: discovery.url, via: robots.sitemaps.length ? "robots.txt" : discovery.url?.endsWith("/sitemap_index.xml") ? "/sitemap_index.xml" : "/sitemap.xml" }
    : { found: false };

  const sample = pickSample(input, discovery.urls, opts.sampleSize ?? SAMPLE_SIZE);
  const site = siteKey(input.hostname);
  const sharedWarnings = robotsR.warning ? [robotsR.warning] : [];

  const outcomes = await mapPool(sample, Math.min(opts.concurrency ?? SITE_MAX_PARALLEL, SITE_MAX_PARALLEL), async (url): Promise<PageOutcome | null> => {
    // Once time is up, pages that have not started are skipped rather than failed.
    if (signal.aborted) return null;
    const template = templateOf(url);
    const pageStart = Date.now();
    try {
      const page = await fetchHtmlPage(url, net, { maxBytes: SITE_PAGE_MAX_BYTES, timeoutMs: SITE_PAGE_TIMEOUT_MS });
      if (siteKey(new URL(page.finalUrl).hostname) !== site) {
        return { url: url.href, template, failure: { code: "fetch_failed", message: "The page redirected to a different site, so it was skipped." } };
      }
      const report = analyse(
        { html: page.text, finalUrl: page.finalUrl, statusCode: page.status, headers: page.headers, redirects: page.redirects, truncated: page.truncated, robots, llms, sitemap, warnings: sharedWarnings },
        url.href,
        pageStart,
      );
      return { url: url.href, template, report };
    } catch (err) {
      // An abort from the deadline is not the page's fault, so it is not reported as a failed page.
      if (signal.aborted && !opts.signal?.aborted) return null;
      if (err instanceof AuditFailure) return { url: url.href, template, failure: { code: err.code, message: err.message } };
      return { url: url.href, template, failure: { code: "fetch_failed", message: "We could not fetch that page." } };
    }
  });

  const finished = outcomes.filter((o): o is PageOutcome => o !== null);
  const audited = finished.filter((o) => o.report);
  if (audited.length === 0) {
    const first = finished.find((o) => o.failure)?.failure;
    if (first) throw new AuditFailure(first.code as AuditFailure["code"], first.message);
    throw new AuditFailure("fetch_failed", "The time limit passed before any page could be checked. Try again, or check a single page.");
  }

  const partial = finished.length < sample.length;
  const notes = [...discovery.notes];
  if (!discovery.found) notes.push("No sitemap was found, so only the page you entered was available to sample.");
  else if (sample.length < 20) notes.push(`The sitemap gave ${sample.length} usable pages, fewer than the 20 we aim for.`);
  if (partial) notes.push(`The time limit passed, so ${finished.length} of ${sample.length} sampled pages were checked. The patterns below use those pages only.`);

  return {
    url: input.href,
    host: site,
    fetchedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
    sampled: sample.length,
    audited: audited.length,
    failedPages: finished
      .filter((o) => o.failure)
      .slice(0, FAILED_PAGES_SHOWN)
      .map((o) => ({ url: o.url, code: o.failure?.code ?? "fetch_failed" })),
    partial,
    sitemapFound: discovery.found,
    ...summarise(finished),
    notes,
  };
}
