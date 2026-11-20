import type { AiSummary, AuditReport, PrioritisedFix } from "@/lib/audit/types";
import { SAMPLE_REPORT, SAMPLE_SUMMARY } from "./sample-report";

/**
 * Worst-case data for the report screen, reachable only in development at /report?demo=worst
 * (see ReportClient). Every value is plausible or at a real limit: a 2,000-character URL, a
 * 63-label hostname, CJK and emoji text, an unbroken snippet, 40 fixes, a zero score.
 */
const LONG_QUERY = "utm_source=newsletter&utm_campaign=" + "spring-sale-2026-".repeat(40);
const LONG_HOST = "a-really-quite-long-subdomain-for-a-regional-franchise.example-hospitality-group-international.co.uk";

function worstReport(): AuditReport {
  const base = structuredClone(SAMPLE_REPORT);
  const moreFixes: PrioritisedFix[] = Array.from({ length: 40 }, (_, i) => ({
    ...base.fixes[i % base.fixes.length],
    title:
      i % 4 === 0
        ? "Ajouter le balisage Organization avec sameAs vers LinkedIn, Facebook et Google Business Profile " + String.fromCodePoint(0x1f680)
        : i % 4 === 1
          ? "ウェブサイトの構造化データを追加して、AI検索エンジンが引用しやすくする"
          : i % 4 === 2
            ? "Allow OAI-SearchBot, ChatGPT-User and PerplexityBot in robots.txt without also opening /admin or /checkout"
            : "Fix",
    snippet:
      i % 3 === 0
        ? `<script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization","name":"${"Name ".repeat(30)}","url":"https://${LONG_HOST}/${LONG_QUERY}"}</script>`
        : base.fixes[i % base.fixes.length].snippet,
    priority: 100 - i,
    pointsAvailable: i % 5,
  }));
  return {
    ...base,
    url: `https://${LONG_HOST}/collections/${"unbroken".repeat(12)}?${LONG_QUERY}`,
    overallScore: 0,
    grade: "F",
    verdict:
      "Almost impossible for AI engines to cite: every answer bot is blocked, the page asks not to be indexed and its text only appears after JavaScript runs on a very slow connection",
    cappedBy:
      "noindex found in the X-Robots-Tag header and the robots meta tag, which caps the score at 25 until both are removed from every template that renders this page",
    fixes: moreFixes,
    categories: base.categories.map((c, i) =>
      i === 2
        ? { ...c, score: 0, checks: [] }
        : {
            ...c,
            score: i === 0 ? 100 : c.score,
            checks: c.checks.map((k, j) =>
              j === 0
                ? {
                    ...k,
                    title: `${"Structured data for ".repeat(4)}${LONG_HOST}`,
                    summary: `Found ${"https://shop.example.net/a-very-long-unbroken-address-".repeat(5)} and nothing else.`,
                    evidence: [LONG_QUERY, "日本語の証拠テキスト ".repeat(20), ...(k.evidence ?? [])],
                  }
                : k,
            ),
          },
    ),
    bots: base.bots.map((b, i) =>
      i === 0
        ? { ...b, bot: "Mozilla-Compatible-ExtremelyLongCrawlerName-Beta-2026", rule: `Disallow: /${"private/".repeat(20)}` }
        : b,
    ),
    page: { ...base.page, wordCount: 1234567, title: null, metaDescription: null, h1: [] },
    warnings: ["robots.txt timed out after 10 seconds, so the crawler rules below assume nothing is blocked."],
    durationMs: 123456,
  };
}

export const WORST_REPORT: AuditReport = worstReport();

export const WORST_SUMMARY: AiSummary = {
  ...SAMPLE_SUMMARY,
  summary: SAMPLE_SUMMARY.summary.repeat(3),
  topActions: SAMPLE_SUMMARY.topActions.map((a) => `${a} ${a}`),
};
