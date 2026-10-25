import { describe, expect, it } from "vitest";
import { analyse } from "../index";
import type { AuditReport, CheckResult } from "../types";
import { shellInput, strongHtml, strongInput, weakInput } from "./fixtures";

function allChecks(report: AuditReport): CheckResult[] {
  return report.categories.flatMap((c) => c.checks);
}
function find(report: AuditReport, id: string): CheckResult {
  const c = allChecks(report).find((k) => k.id === id);
  if (!c) throw new Error(`no check ${id}`);
  return c;
}

describe("audit pipeline", () => {
  it("scores a strong page 80 or above with no cap", () => {
    const r = analyse(strongInput(), "https://www.brightsmile.example/services/teeth-whitening");
    expect(r.overallScore).toBeGreaterThanOrEqual(80);
    expect(r.grade).toMatch(/^[AB]$/);
    expect(r.cappedBy).toBeUndefined();
    expect(r.bots).toHaveLength(14);
    expect(r.page.businessName).toBe("BrightSmile Dental");
    expect(r.page.h1).toEqual(["Teeth whitening in Leeds"]);
    expect(r.page.schemaTypes).toEqual(expect.arrayContaining(["Dentist", "FAQPage", "Service"]));
    // category weights sum to 1
    expect(r.categories.reduce((s, c) => s + c.weight, 0)).toBeCloseTo(1, 5);
    for (const id of ["robots-answer-bots", "indexable", "server-rendered", "jsonld-valid", "schema-organization", "schema-sameas", "h1-single", "answer-first", "question-headings", "contact-details"]) {
      expect(find(r, id).status, id).toBe("pass");
    }
  });

  it("scores a weak page below 50 and attaches fixes with snippets where they make sense", () => {
    const r = analyse(weakInput(), "https://weak.example/page");
    expect(r.overallScore).toBeLessThan(50);
    expect(["D", "F"]).toContain(r.grade);
    expect(find(r, "h1-single").status).toBe("warn");
    expect(find(r, "meta-description").status).toBe("fail");
    expect(find(r, "jsonld-valid").status).toBe("fail");
    expect(find(r, "schema-organization").fix?.snippet).toContain('"@type": "Organization"');
    expect(find(r, "llms-txt").fix?.snippet).toContain("# ");
    // every warn/fail has a fix with a how
    for (const c of allChecks(r)) {
      if (c.status === "warn" || c.status === "fail") {
        expect(c.fix, c.id).toBeDefined();
        expect(c.fix?.how.length, c.id).toBeGreaterThan(20);
      }
      expect(c.fix?.title + (c.fix?.how ?? "") + c.summary).not.toContain("!");
    }
    // fixes are sorted by priority, highest first
    for (let i = 1; i < r.fixes.length; i++) expect(r.fixes[i - 1].priority).toBeGreaterThanOrEqual(r.fixes[i].priority);
    expect(r.fixes.length).toBeGreaterThan(5);
  });

  it("caps a JavaScript app shell at 45", () => {
    const r = analyse(shellInput(), "https://spa.example/");
    expect(find(r, "server-rendered").status).toBe("fail");
    expect(r.overallScore).toBe(45);
    expect(r.cappedBy).toMatch(/JavaScript/);
    expect(r.verdict).toMatch(/JavaScript/);
  });

  it("does not call a page a JavaScript shell when its HTML was cut off at the size limit", () => {
    const r = analyse({ ...shellInput(), truncated: true }, "https://huge.example/");
    expect(find(r, "server-rendered").status).toBe("warn");
    expect(r.cappedBy).toBeUndefined();
  });

  it("caps a noindex page at 25", () => {
    const html = strongHtml('<meta name="robots" content="noindex, follow">');
    const r = analyse(strongInput({ html }), "https://www.brightsmile.example/services/teeth-whitening");
    expect(find(r, "indexable").status).toBe("fail");
    expect(r.overallScore).toBe(25);
    expect(r.cappedBy).toMatch(/noindex/);
    expect(r.grade).toBe("F");
  });

  it("detects noindex from the X-Robots-Tag header", () => {
    const r = analyse(strongInput({ headers: { "x-robots-tag": "googlebot: noindex" } }), "u");
    expect(find(r, "indexable").status).toBe("fail");
  });

  it("warns on nosnippet", () => {
    const html = strongHtml('<meta name="robots" content="max-snippet: 0">');
    const r = analyse(strongInput({ html }), "u");
    expect(find(r, "indexable").status).toBe("warn");
  });

  it("caps at 35 when Googlebot and Bingbot are both blocked", () => {
    const robots = { status: "found" as const, httpStatus: 200, text: "User-agent: Googlebot\nDisallow: /\nUser-agent: Bingbot\nDisallow: /\n", sitemaps: [] };
    const r = analyse(strongInput({ robots }), "u");
    expect(find(r, "robots-answer-bots").status).toBe("fail");
    expect(r.overallScore).toBe(35);
    expect(r.cappedBy).toMatch(/Googlebot/);
  });

  it("caps at 35 when every answer bot is blocked, and gives a robots.txt snippet", () => {
    const text = ["OAI-SearchBot", "ChatGPT-User", "PerplexityBot", "Perplexity-User", "Claude-SearchBot", "Claude-User"]
      .map((b) => `User-agent: ${b}\nDisallow: /`)
      .join("\n");
    const r = analyse(strongInput({ robots: { status: "found", httpStatus: 200, text, sitemaps: [] } }), "u");
    expect(r.overallScore).toBe(35);
    expect(find(r, "robots-answer-bots").fix?.snippet).toContain("User-agent: OAI-SearchBot\nAllow: /");
  });

  it("warns (not fails) when only some answer bots are blocked, and treats training bots as information", () => {
    const text = "User-agent: PerplexityBot\nDisallow: /\n\nUser-agent: GPTBot\nDisallow: /\n\nUser-agent: Google-Extended\nDisallow: /";
    const r = analyse(strongInput({ robots: { status: "found", httpStatus: 200, text, sitemaps: [] } }), "u");
    expect(find(r, "robots-answer-bots").status).toBe("warn");
    const training = find(r, "robots-training-bots");
    expect(training.status).toBe("info");
    expect(training.maxPoints).toBe(0);
    expect(training.evidence?.join(" ")).toMatch(/does not affect Google AI Overviews/);
    expect(r.cappedBy).toBeUndefined();
  });

  it("keeps category scores within 0..100 and the overall score consistent with the weights", () => {
    for (const input of [strongInput(), weakInput(), shellInput()]) {
      const r = analyse(input, "u");
      for (const c of r.categories) {
        expect(c.score).toBeGreaterThanOrEqual(0);
        expect(c.score).toBeLessThanOrEqual(100);
      }
      const raw = Math.round(r.categories.reduce((s, c) => s + c.score * c.weight, 0));
      expect(r.overallScore).toBeLessThanOrEqual(raw);
    }
  });
});
