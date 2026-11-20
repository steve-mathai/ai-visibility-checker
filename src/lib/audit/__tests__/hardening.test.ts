import { describe, expect, it } from "vitest";
import { analyse, buildContext } from "../index";
import { evaluate, matchesPattern, parseRobots } from "../robots";
import { parsePage, LIMITS } from "../parse";
import { escapeHtml, jsonLdSnippet } from "../checks/util";
import type { AuditReport } from "../types";
import { robotsMissing, llmsMissing, sitemapMissing, strongInput } from "./fixtures";

const input = (html: string, url = "https://hostile.example/page") => ({
  html,
  finalUrl: url,
  statusCode: 200,
  robots: robotsMissing,
  llms: llmsMissing,
  sitemap: sitemapMissing,
});

describe("robots.txt matching (robots-pattern-wildcard-regex-backtracking-redos)", () => {
  it("matches a hostile wildcard pattern in linear time", () => {
    const pattern = "/*a*a*a*a*a*a*a*a*a*a*b";
    const path = "/" + "a".repeat(3000);
    const t0 = performance.now();
    expect(matchesPattern(pattern, path)).toBe(false);
    expect(evaluate(`User-agent: *\nDisallow: ${pattern}`, "GPTBot", path).allowed).toBe(true);
    expect(performance.now() - t0).toBeLessThan(100);
  });

  it("implements * and trailing $ correctly", () => {
    expect(matchesPattern("/a*c", "/abbbc")).toBe(true);
    expect(matchesPattern("/a*c", "/abbb")).toBe(false);
    expect(matchesPattern("/*.pdf$", "/x/y.pdf")).toBe(true);
    expect(matchesPattern("/*.pdf$", "/x/y.pdf?q=1")).toBe(false);
    expect(matchesPattern("/private", "/private/page")).toBe(true);
    expect(matchesPattern("/*", "/")).toBe(true);
    expect(matchesPattern("/a*$", "/a")).toBe(true);
  });

  it("caps rules per group and pattern length, and truncates the reported rule", () => {
    const rules = Array.from({ length: 1500 }, (_, i) => `Disallow: /r${i}`).join("\n");
    const parsed = parseRobots(`User-agent: *\n${rules}`);
    expect(parsed.groups[0].rules.length).toBe(1000);
    const long = parseRobots(`User-agent: *\nDisallow: /${"x".repeat(2000)}`);
    expect(long.groups[0].rules[0].pattern.length).toBe(512);
    const d = evaluate(`User-agent: *\nDisallow: /${"x".repeat(400)}`, "GPTBot", `/${"x".repeat(400)}`);
    expect(d.rule.length).toBeLessThanOrEqual(200);
  });
});

describe("parser bounds (audit-parse-quadratic-array-includes-high-cardinality, audit-parse-dom-clone-memory-amplification)", () => {
  it("caps sections and finishes quickly on a high-cardinality page", () => {
    const html = `<!doctype html><html><head><title>t</title></head><body>${"<h2>x</h2><ul><li>y</li></ul>".repeat(20_000)}</body></html>`;
    const t0 = performance.now();
    const ctx = buildContext(input(html));
    expect(ctx.page.sections.length).toBe(LIMITS.sections);
    const report = analyse(input(html), "https://hostile.example/page");
    expect(report.warnings.join(" ")).toContain("unusually large number of elements");
    expect(performance.now() - t0).toBeLessThan(10_000);
  });

  it("caps phone matches, link count and schema types", () => {
    const phones = Array.from({ length: 2000 }, (_, i) => `+1 555 ${String(1000000 + i).slice(0, 3)} ${String(2000000 + i).slice(1, 5)}`).join(" ");
    const links = Array.from({ length: 6000 }, (_, i) => `<a href="/p${i}">p${i}</a>`).join("");
    const micro = Array.from({ length: 500 }, (_, i) => `<div itemscope itemtype="https://schema.org/T${i}"></div>`).join("");
    const page = parsePage(`<html><body><p>${phones}</p>${links}${micro}</body></html>`, "https://hostile.example/", 200);
    expect(page.textPhones.length).toBeLessThanOrEqual(LIMITS.phones);
    expect(page.facts.schemaTypes.length).toBeLessThanOrEqual(LIMITS.types);
    expect(page.links.length).toBeLessThanOrEqual(LIMITS.links);
  });

  it("skips clone-based text extraction above the element limit and warns", () => {
    const html = `<html><body><p>hello world</p>${"<i></i>".repeat(LIMITS.elements + 10)}</body></html>`;
    const page = parsePage(html, "https://hostile.example/", 200);
    expect(page.parseWarnings.join(" ")).toContain("too large to analyse fully");
    expect(page.visibleText).toContain("hello world");
  });

  it("does not fail on a malformed tel: link", () => {
    const page = parsePage('<html><body><a href="tel:%E0%A4%A">call</a><a href="tel:+1%20555%20123%204567">ok</a></body></html>', "https://x.example/", 200);
    expect(page.telLinks.length).toBe(2);
  });
});

describe("fix snippets are safe to paste (checks.fix-snippet-unescaped-fetched-strings)", () => {
  it("escapes < > & and line separators in JSON-LD snippets", () => {
    const s = jsonLdSnippet({ name: "x</script><script>alert(1)</script>&" + String.fromCharCode(0x2028) });
    const inner = s.slice(s.indexOf("\n") + 1, s.lastIndexOf("\n</script>"));
    expect(inner).not.toContain("<");
    expect(inner).not.toContain(">");
    expect(inner).not.toContain("&");
    expect(inner).not.toContain(String.fromCharCode(0x2028));
    expect(inner).toContain("\\u003c/script\\u003e");
    expect(JSON.parse(inner).name).toContain("</script><script>alert(1)</script>");
    expect(s.match(/<\/script>/g)).toHaveLength(1);
  });

  it("escapeHtml covers text and attribute contexts", () => {
    expect(escapeHtml(`<a href="x" b='y'>&`)).toBe("&lt;a href=&quot;x&quot; b=&#39;y&#39;&gt;&amp;");
  });

  function snippets(report: AuditReport): string[] {
    // llms.txt content is a plain markdown file, not HTML, so it is not an HTML injection surface.
    return report.categories
      .flatMap((c) => c.checks.map((k) => k.fix?.snippet))
      .filter((x): x is string => Boolean(x) && !(x as string).startsWith("# "));
  }

  it("a hostile title and h1 produce no executable breakout in any snippet", () => {
    const evil = "x</script><script>alert(1)</script>";
    const html = `<!doctype html><html lang="en"><head><title>${escapeHtml(evil)}</title></head><body><h1>${escapeHtml(evil)}</h1><p>short</p></body></html>`;
    const report = analyse(input(html), "https://hostile.example/page");
    const all = snippets(report);
    expect(all.length).toBeGreaterThan(0);
    for (const s of all) {
      expect(s).not.toContain("<script>alert(1)");
      expect(s).not.toContain("</script><script>");
    }
    for (const s of all.filter((x) => x.includes('<script type="application/ld+json">'))) {
      expect(s.match(/<\/script>/g)?.length ?? 0).toBe(1);
    }
  });

  it("an og:site_name with a quote and script tag stays attribute-safe in the entity snippet", () => {
    const evil = `"><script>alert(1)</script>`;
    const html = `<!doctype html><html lang="en"><head><title>Page | Other Name</title><meta property="og:site_name" content="${escapeHtml(evil)}"></head><body><h1>Hello</h1><p>text</p></body></html>`;
    const report = analyse({ ...input(html) }, "https://hostile.example/page");
    const all = snippets(report).join("\n");
    expect(all).not.toContain("<script>alert(1)");
    expect(all).not.toContain(`content=""><script`);
  });

  it("existing strong page still analyses (sanity)", () => {
    const r = analyse(strongInput(), "https://www.brightsmile.example/services/teeth-whitening");
    expect(r.overallScore).toBeGreaterThanOrEqual(80);
  });
});
