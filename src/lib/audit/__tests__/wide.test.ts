import { Readable } from "node:stream";
import { describe, expect, it } from "vitest";
import { runCompare } from "../compare";
import type { RequestImpl, Resolver, TransportRequest } from "../fetch";
import { runSiteAudit } from "../multi";
import { pickSample, templateOf } from "../sample";
import { discoverSitemapUrls, parseSitemapXml, SITEMAP_LIMITS } from "../sitemap";
import { AuditFailure } from "../index";
import { strongHtml, weakHtml } from "./fixtures";

const HOST = "www.site.example";
const ORIGIN = `https://${HOST}`;

const resolver: Resolver = async (host) =>
  host.startsWith("internal.") ? [{ address: "10.0.0.5", family: 4 }] : [{ address: "93.184.216.34", family: 4 }];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const reply = (status: number, type: string, body: string) => ({
  status,
  headers: { "content-type": type },
  body: Readable.from(body.length ? [Buffer.from(body)] : []),
});

const urlset = (urls: string[]) => `<?xml version="1.0"?><urlset>${urls.map((u) => `<url><loc>${u}</loc></url>`).join("")}</urlset>`;
const index = (urls: string[]) => `<?xml version="1.0"?><sitemapindex>${urls.map((u) => `<sitemap><loc>${u}</loc></sitemap>`).join("")}</sitemapindex>`;

interface FakeOptions {
  /** Keyed by full URL, or by host + path for hosts without a scheme in the test. */
  routes?: Record<string, string>;
  /** Per page request, in ms. */
  pageLatencyMs?: number;
  sideLatencyMs?: number;
}

/** An offline site: records every request, tracks peak concurrency, and answers after a simulated delay. */
function fakeNetwork(opts: FakeOptions = {}) {
  const requested: string[] = [];
  let inFlight = 0;
  let peak = 0;
  const requestImpl: RequestImpl = async (req: TransportRequest) => {
    const key = req.url.host + req.url.pathname;
    requested.push(req.url.href);
    inFlight++;
    peak = Math.max(peak, inFlight);
    try {
      const side = req.url.pathname === "/robots.txt" || req.url.pathname === "/llms.txt" || req.url.pathname.includes("sitemap");
      await sleep(side ? (opts.sideLatencyMs ?? 0) : (opts.pageLatencyMs ?? 0));
      const body = opts.routes?.[req.url.href] ?? opts.routes?.[key];
      if (body !== undefined) {
        const type = req.url.pathname.endsWith(".xml") ? "application/xml" : req.url.pathname.endsWith(".txt") ? "text/plain" : "text/html";
        return reply(200, type, body);
      }
      return reply(404, "text/plain", "");
    } finally {
      inFlight--;
    }
  };
  return { requestImpl, requested, peak: () => peak };
}

/** A site with robots.txt, a sitemap and pages in four sections; /blog pages are thin, the rest are strong. */
function siteRoutes(pageCount: number) {
  const sections = ["services", "blog", "products", "guides"];
  const urls: string[] = [`${ORIGIN}/`];
  const routes: Record<string, string> = {
    [`${ORIGIN}/robots.txt`]: `User-agent: *\nDisallow: /admin/\nSitemap: ${ORIGIN}/sitemap.xml\n`,
    [`${ORIGIN}/`]: strongHtml(),
  };
  for (let i = 0; i < pageCount; i++) {
    const section = i % 5 === 4 ? null : sections[i % 4];
    const url = section ? `${ORIGIN}/${section}/page-${i}` : `${ORIGIN}/info-${i}`;
    urls.push(url);
    routes[url] = section === "blog" ? weakHtml : strongHtml();
  }
  routes[`${ORIGIN}/sitemap.xml`] = urlset(urls);
  return { routes, urls };
}

describe("sitemap parsing", () => {
  it("reads loc entries, decodes entities and CDATA, and tells an index from a urlset", () => {
    const parsed = parseSitemapXml(`<urlset><url><loc> https://a.example/x?a=1&amp;b=2 </loc></url><url><loc><![CDATA[https://a.example/y]]></loc></url></urlset>`, 10);
    expect(parsed.kind).toBe("urlset");
    expect(parsed.locs).toEqual(["https://a.example/x?a=1&b=2", "https://a.example/y"]);
    expect(parseSitemapXml(index(["https://a.example/s1.xml"]), 10).kind).toBe("index");
  });

  it("stops at the limit and says so", () => {
    const parsed = parseSitemapXml(urlset(Array.from({ length: 50 }, (_, i) => `https://a.example/${i}`)), 10);
    expect(parsed.locs).toHaveLength(10);
    expect(parsed.capped).toBe(true);
  });
});

describe("sitemap discovery guards", () => {
  it("drops off-site addresses and never requests them", async () => {
    const net = fakeNetwork({
      routes: {
        [`${ORIGIN}/sitemap.xml`]: urlset([`${ORIGIN}/a`, "https://evil.example/b", "http://127.0.0.1/c", "http://169.254.169.254/latest", "ftp://www.site.example/d", `${ORIGIN}/e`]),
      },
    });
    const found = await discoverSitemapUrls(new URL(ORIGIN), [], { resolver, requestImpl: net.requestImpl });
    expect(found.urls).toEqual([`${ORIGIN}/a`, `${ORIGIN}/e`]);
    expect(found.notes.join(" ")).toContain("different site");
    expect(net.requested.every((u) => new URL(u).host === HOST)).toBe(true);
  });

  it("ignores robots.txt Sitemap lines that point off-site or at private addresses, and a child sitemap on another host", async () => {
    const net = fakeNetwork({
      routes: {
        [`${ORIGIN}/real.xml`]: index([`${ORIGIN}/child.xml`, "https://evil.example/child.xml", "http://10.0.0.5/child.xml"]),
        [`${ORIGIN}/child.xml`]: urlset([`${ORIGIN}/ok`]),
      },
    });
    const found = await discoverSitemapUrls(new URL(ORIGIN), ["http://10.0.0.5/sitemap.xml", "https://evil.example/sitemap.xml", `${ORIGIN}/real.xml`], {
      resolver,
      requestImpl: net.requestImpl,
    });
    expect(found.urls).toEqual([`${ORIGIN}/ok`]);
    expect([...net.requested].sort()).toEqual([`${ORIGIN}/child.xml`, `${ORIGIN}/real.xml`]);
  });

  it("blocks a site whose own hostname resolves to a private address, before any request", async () => {
    const net = fakeNetwork({ routes: {} });
    await expect(runSiteAudit("https://internal.corp-site.example/", { resolver, requestImpl: net.requestImpl })).rejects.toMatchObject({ code: "fetch_failed" });
    expect(net.requested).toHaveLength(0);
    await expect(runSiteAudit("http://127.0.0.1/", { resolver, requestImpl: net.requestImpl })).rejects.toBeInstanceOf(AuditFailure);
    expect(net.requested).toHaveLength(0);
  });

  it("enforces the caps: urls, files read, bytes, one index level, no .gz", async () => {
    const many = Array.from({ length: 6000 }, (_, i) => `${ORIGIN}/p/${i}`);
    const children = Array.from({ length: 20 }, (_, i) => `${ORIGIN}/s${i}.xml`);
    const routes: Record<string, string> = {
      [`${ORIGIN}/big.xml`]: urlset(many),
      [`${ORIGIN}/idx.xml`]: index([...children, `${ORIGIN}/archive.xml.gz`]),
      [`${ORIGIN}/nested.xml`]: index([`${ORIGIN}/deeper.xml`]),
      [`${ORIGIN}/deeper.xml`]: urlset([`${ORIGIN}/deep`]),
    };
    for (const c of children) routes[c] = urlset([`${ORIGIN}/c/${c.length}`]);

    const big = fakeNetwork({ routes });
    const capped = await discoverSitemapUrls(new URL(ORIGIN), [`${ORIGIN}/big.xml`], { resolver, requestImpl: big.requestImpl });
    expect(capped.urls).toHaveLength(SITEMAP_LIMITS.maxUrls);

    const idx = fakeNetwork({ routes });
    await discoverSitemapUrls(new URL(ORIGIN), [`${ORIGIN}/idx.xml`], { resolver, requestImpl: idx.requestImpl });
    expect(idx.requested.length).toBeLessThanOrEqual(SITEMAP_LIMITS.maxFiles);
    expect(idx.requested.some((u) => u.endsWith(".gz"))).toBe(false);

    const nested = fakeNetwork({ routes });
    const result = await discoverSitemapUrls(new URL(ORIGIN), [`${ORIGIN}/nested.xml`], { resolver, requestImpl: nested.requestImpl });
    expect(result.urls).toEqual([]);

    const huge = fakeNetwork({ routes: { [`${ORIGIN}/sitemap.xml`]: urlset(Array.from({ length: 80_000 }, (_, i) => `${ORIGIN}/long/path/number/${i}`)) } });
    const truncated = await discoverSitemapUrls(new URL(ORIGIN), [], { resolver, requestImpl: huge.requestImpl });
    expect(truncated.notes.join(" ")).toContain("larger than 2 MB");
    expect(truncated.urls.length).toBeLessThanOrEqual(SITEMAP_LIMITS.maxUrls);
  });
});

describe("page sampling", () => {
  it("dedupes, skips non-HTML paths and other hosts, and spreads across page types", () => {
    const candidates = [
      ...Array.from({ length: 100 }, (_, i) => `${ORIGIN}/blog/post-${i}`),
      `${ORIGIN}/blog/post-1/`,
      `${ORIGIN}/blog/post-2#top`,
      `${ORIGIN}/files/report.pdf`,
      `${ORIGIN}/img/logo.png`,
      "https://other.example/x",
      "http://site.example/shop/a",
      `${ORIGIN}/shop/b.html`,
      `${ORIGIN}/about`,
      `${ORIGIN}/contact`,
    ];
    const sample = pickSample(new URL(`${ORIGIN}/`), candidates, 20);
    const hrefs = sample.map((u) => u.href);
    expect(hrefs[0]).toBe(`${ORIGIN}/`);
    expect(sample).toHaveLength(20);
    expect(new Set(hrefs).size).toBe(20);
    expect(hrefs.some((h) => h.endsWith(".pdf") || h.endsWith(".png") || h.includes("other.example"))).toBe(false);
    const types = new Set(sample.map(templateOf));
    expect(types).toEqual(new Set(["/", "/blog/*", "/shop/*", "/*"]));
    expect(sample.filter((u) => templateOf(u) === "/blog/*").length).toBeLessThan(20 - 4);
  });

  it("never returns more than the size asked for", () => {
    const candidates = Array.from({ length: 500 }, (_, i) => `${ORIGIN}/s${i % 30}/p${i}`);
    expect(pickSample(new URL(`${ORIGIN}/`), candidates, 50).length).toBeLessThanOrEqual(50);
  });
});

describe("site audit", () => {
  it("audits a 40-page sample in under 60 s with simulated latency, fetching robots and llms once", async () => {
    const { routes } = siteRoutes(200);
    // 1 s per page and 0.3 s per side file: a slow but realistic site.
    const net = fakeNetwork({ routes, pageLatencyMs: 1000, sideLatencyMs: 300 });
    const t0 = performance.now();
    const report = await runSiteAudit(`${ORIGIN}/`, { resolver, requestImpl: net.requestImpl });
    const elapsedMs = performance.now() - t0;
    console.log(`40-page site audit with 1000 ms page latency: ${Math.round(elapsedMs)} ms wall, peak ${net.peak()} requests in flight`);

    expect(report.sampled).toBe(40);
    expect(report.audited).toBe(40);
    expect(report.partial).toBe(false);
    expect(elapsedMs).toBeLessThan(60_000);
    expect(net.peak()).toBeLessThanOrEqual(4);
    expect(net.requested.filter((u) => u.endsWith("/robots.txt"))).toHaveLength(1);
    expect(net.requested.filter((u) => u.endsWith("/llms.txt"))).toHaveLength(1);
    expect(report.sitemapFound).toBe(true);
    expect(report.templates.map((t) => t.template)).toEqual(expect.arrayContaining(["/", "/blog/*", "/services/*", "/products/*", "/guides/*", "/*"]));
  }, 30_000);

  it("reports template-level patterns: thin blog pages fail the meta description check, other types do not", async () => {
    const { routes } = siteRoutes(60);
    const net = fakeNetwork({ routes });
    const report = await runSiteAudit(`${ORIGIN}/`, { resolver, requestImpl: net.requestImpl, sampleSize: 30 });
    const meta = report.patterns.find((p) => p.checkId === "meta-description");
    expect(meta).toBeDefined();
    expect(meta?.byTemplate.map((t) => t.template)).toEqual(["/blog/*"]);
    expect(meta?.failing).toBe(meta?.byTemplate[0].failing);
    expect(report.topFixes.length).toBeLessThanOrEqual(5);
    expect(report.topFixes[0].pagesAffected).toBeGreaterThanOrEqual(report.topFixes[report.topFixes.length - 1].pagesAffected);
    const blogPages = report.pages.filter((p) => p.template === "/blog/*").length;
    expect(report.templates.find((t) => t.template === "/blog/*")?.pages).toBe(blogPages);
  });

  it("returns a partial result with a note when the deadline passes", async () => {
    const { routes } = siteRoutes(200);
    const net = fakeNetwork({ routes, pageLatencyMs: 150 });
    const report = await runSiteAudit(`${ORIGIN}/`, { resolver, requestImpl: net.requestImpl, deadlineMs: 500 });
    expect(report.partial).toBe(true);
    expect(report.audited).toBeGreaterThan(0);
    expect(report.audited).toBeLessThan(report.sampled);
    expect(report.failedPages).toHaveLength(0);
    expect(report.notes.join(" ")).toContain("time limit");
  });

  it("fails with a plain error when the deadline passes before any page is done", async () => {
    const { routes } = siteRoutes(20);
    const net = fakeNetwork({ routes, sideLatencyMs: 300 });
    await expect(runSiteAudit(`${ORIGIN}/`, { resolver, requestImpl: net.requestImpl, deadlineMs: 50 })).rejects.toBeInstanceOf(AuditFailure);
  });

  it("counts a failing page without failing the run", async () => {
    const { routes } = siteRoutes(20);
    delete routes[`${ORIGIN}/services/page-0`];
    const net = fakeNetwork({ routes });
    const report = await runSiteAudit(`${ORIGIN}/`, { resolver, requestImpl: net.requestImpl, sampleSize: 30 });
    expect(report.failedPages).toEqual([{ url: `${ORIGIN}/services/page-0`, code: "fetch_failed" }]);
    expect(report.audited).toBe(report.sampled - 1);
  });
});

describe("compare", () => {
  it("returns a report for each good address and an error for the failing one", async () => {
    const net = fakeNetwork({
      routes: {
        "good-one.example/": strongHtml(),
        "good-two.example/": weakHtml,
        "good-one.example/robots.txt": "User-agent: *\nAllow: /\n",
      },
    });
    const results = await runCompare(["good-one.example", "internal.bad.example", "good-two.example", "missing.example"], { resolver, requestImpl: net.requestImpl });
    expect(results.map((r) => r.ok)).toEqual([true, false, true, false]);
    expect(results.map((r) => r.url)).toEqual(["good-one.example", "internal.bad.example", "good-two.example", "missing.example"]);
    const [one, bad, two, missing] = results;
    expect(one.ok && one.report.overallScore).toBeGreaterThan(two.ok ? two.report.overallScore : 100);
    expect(bad.ok ? "" : bad.code).toBe("fetch_failed");
    expect(missing.ok ? "" : missing.error).toContain("404");
    // The private-address failure says nothing about why.
    expect(bad.ok ? "" : bad.error).not.toMatch(/10\.0\.0|private/i);
  });
});
