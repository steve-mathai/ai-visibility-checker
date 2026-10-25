import type { CheckResult } from "../types";
import type { AuditContext } from "../context";
import { brandName, check, fix, hasType, isQuestionHeading, plural, questionSections, truncate } from "./util";

const CAT = "content" as const;

function singleH1(ctx: AuditContext): CheckResult {
  const max = 5;
  const h1s = ctx.page.facts.h1;
  const evidence = h1s.map((h) => `H1: ${h}`);
  if (h1s.length === 1) {
    return check(CAT, "h1-single", "Exactly one H1 heading", max, "pass", max, `The page has a single H1: "${truncate(h1s[0], 80)}".`, { evidence });
  }
  if (h1s.length === 0) {
    const suggestion = ctx.page.facts.title ? ctx.page.facts.title.split(/\s+[|\-–—]\s+/)[0] : brandName(ctx);
    return check(CAT, "h1-single", "Exactly one H1 heading", max, "fail", 0, "The page has no H1 heading, so there is no clear statement of what it is about.", {
      evidence,
      fix: fix(
        "Add one H1 heading that names the page's topic",
        "The H1 is the main label for the page. Engines use it, alongside the title, to decide what question the page answers.",
        "Add a single H1 near the top of the page that says in plain words what the page covers. Your page builder may call this the \"Heading 1\" style.",
        "high",
        "quick",
        `<h1>${suggestion}</h1>`,
      ),
    });
  }
  return check(CAT, "h1-single", "Exactly one H1 heading", max, "warn", 2, `The page has ${h1s.length} H1 headings, which blurs what the main topic is.`, {
    evidence,
    fix: fix(
      "Keep one H1 and change the others to H2",
      "With several H1s, engines cannot tell which one is the main topic of the page.",
      `Keep the H1 that best states the page topic ("${truncate(h1s[0], 60)}" is the first one found) and change the others to H2 or H3. In most page builders this is a drop-down on the heading block.`,
      "medium",
      "quick",
    ),
  });
}

function headingHierarchy(ctx: AuditContext): CheckResult {
  const max = 4;
  const headings = ctx.page.facts.headings;
  const words = ctx.page.facts.wordCount;
  if (!headings.length) {
    return check(CAT, "heading-hierarchy", "Headings are well structured", max, "fail", 0, "The page has no headings, so it is one undivided block of text.", {
      fix: fix(
        "Break the page into sections with H2 headings",
        "Headings let engines pull out the part of the page that answers a specific question. Without them they have to use the whole page or skip it.",
        "Add an H2 heading above each distinct topic on the page, and H3 headings for sub-points under them. Do not skip levels (for example, going from H2 straight to H4).",
        "high",
        "moderate",
      ),
    });
  }
  const skips: string[] = [];
  for (let i = 1; i < headings.length; i++) {
    if (headings[i].level > headings[i - 1].level + 1) {
      skips.push(`H${headings[i - 1].level} "${truncate(headings[i - 1].text, 40)}" is followed by H${headings[i].level} "${truncate(headings[i].text, 40)}"`);
    }
  }
  const h2Count = headings.filter((h) => h.level === 2).length;
  const tooFewH2 = words > 300 && h2Count < 2;
  const evidence = [`Outline: ${headings.slice(0, 12).map((h) => `H${h.level}`).join(" > ")}${headings.length > 12 ? " ..." : ""}`, ...skips.slice(0, 3)];
  if (!skips.length && !tooFewH2) {
    return check(CAT, "heading-hierarchy", "Headings are well structured", max, "pass", max, `${plural(headings.length, "heading")} in a logical order with no skipped levels.`, { evidence });
  }
  const problems: string[] = [];
  if (skips.length) problems.push(`${plural(skips.length, "heading level")} skipped`);
  if (tooFewH2) problems.push(`only ${plural(h2Count, "H2 section heading")} on a ${words}-word page`);
  return check(CAT, "heading-hierarchy", "Headings are well structured", max, "warn", max - (skips.length ? 2 : 0) - (tooFewH2 ? 2 : 0), `Heading structure needs work: ${problems.join(" and ")}.`, {
    evidence,
    fix: fix(
      "Tidy the heading outline",
      "A clean outline (H1, then H2 sections, then H3 sub-points) shows engines where each topic starts and ends so they can quote the right part.",
      `${skips.length ? "Change skipped levels so each heading is only one level below the one before it. " : ""}${tooFewH2 ? "Split the page into at least two sections with H2 headings, one per topic or question. " : ""}Choose heading levels for structure, not for how big the text looks; use styling for size.`,
      "medium",
      "quick",
    ),
  });
}

const EXAMPLES: [RegExp, (b: string) => string][] = [
  [/pric|cost|fee|plan/i, (b) => `How much does ${b} cost?`],
  [/feature|benefit|what we (do|offer)|offer|solution/i, (b) => `What does ${b} include?`],
  [/about|story|who we are|team/i, (b) => `Who is ${b}?`],
  [/process|how it works|steps|approach/i, (b) => `How does ${b} work?`],
  [/contact|get in touch|reach/i, (b) => `How can I contact ${b}?`],
  [/service/i, (b) => `What services does ${b} offer?`],
  [/location|area|where|visit/i, (b) => `Where is ${b} located?`],
  [/faq|question/i, (b) => `What do customers ask ${b} most?`],
];

function questionHeadings(ctx: AuditContext): CheckResult {
  const words = ctx.page.facts.wordCount;
  const qs = questionSections(ctx);
  const evidence = qs.slice(0, 6).map((s) => `H${s.level}: ${s.heading}`);
  if (words <= 300) {
    return check(CAT, "question-headings", "Headings phrased as questions", 0, "info", 0, qs.length ? `${plural(qs.length, "question-style heading")} found. On short pages this is optional.` : "No question-style headings, which is fine on a short page.", { evidence });
  }
  const max = 4;
  if (qs.length >= 2) {
    return check(CAT, "question-headings", "Headings phrased as questions", max, "pass", max, `${plural(qs.length, "section heading")} are phrased as questions, matching how people ask AI engines.`, { evidence });
  }
  const brand = brandName(ctx);
  const examples: string[] = [];
  for (const s of ctx.page.sections) {
    const hit = EXAMPLES.find(([re]) => re.test(s.heading));
    if (hit && !isQuestionHeading(s.heading)) examples.push(`"${s.heading}" becomes "${hit[1](brand)}"`);
    if (examples.length >= 3) break;
  }
  const how = examples.length
    ? `Rewrite some H2 or H3 headings as the question a customer would type or speak. For example: ${examples.join("; ")}.`
    : `Rewrite some H2 or H3 headings as the question a customer would type or speak, such as "How much does it cost?", "How long does it take?" or "Who is it for?" Use the real questions your sales or support team hear.`;
  return check(CAT, "question-headings", "Headings phrased as questions", max, qs.length === 1 ? "warn" : "fail", qs.length === 1 ? 2 : 0, qs.length === 1 ? "Only one section heading is phrased as a question." : "No section headings are phrased as questions.", {
    evidence,
    fix: fix(
      "Phrase some headings as customer questions",
      "People ask AI engines full questions. A heading that matches the question, followed by a direct answer, is the easiest kind of passage to lift into an answer.",
      how,
      "medium",
      "quick",
    ),
  });
}

function faqBlock(ctx: AuditContext): CheckResult {
  const p = ctx.page;
  const words = p.facts.wordCount;
  const signals: string[] = [];
  if (hasType(ctx, "FAQPage")) signals.push("FAQPage structured data");
  if (p.detailsCount >= 2) signals.push(`${p.detailsCount} expandable details/summary items`);
  if (p.hasFaqHeading) signals.push("a heading that mentions FAQ");
  if (signals.length) {
    return check(CAT, "faq-block", "FAQ section", 3, "pass", 3, `The page has an FAQ section (${signals.join(", ")}).`, { evidence: signals });
  }
  if (words < 300) {
    return check(CAT, "faq-block", "FAQ section", 0, "info", 0, "No FAQ section found. Optional on a short page.");
  }
  const brand = brandName(ctx);
  const snippet = [
    "<h2>Frequently asked questions</h2>",
    "<details>",
    `  <summary>What does ${brand} do?</summary>`,
    "  <p>[Answer in one or two sentences, under 60 words.]</p>",
    "</details>",
    "<details>",
    `  <summary>How can I contact ${brand}?</summary>`,
    "  <p>[Answer in one or two sentences, under 60 words.]</p>",
    "</details>",
  ].join("\n");
  return check(CAT, "faq-block", "FAQ section", 3, "warn", 0, "The page has no FAQ section.", {
    fix: fix(
      "Add a short FAQ section",
      "An FAQ gives engines ready-made question and answer pairs. It is also where you can answer the objections customers raise before they buy.",
      "Add 4 to 6 real customer questions near the bottom of the page, each with a direct answer of one or two sentences. Use your support inbox and sales calls for the questions. Then mark them up with FAQPage structured data.",
      "medium",
      "moderate",
      snippet,
    ),
  });
}

function answerFirst(ctx: AuditContext): CheckResult {
  const words = ctx.page.facts.wordCount;
  const sections = ctx.page.sections;
  const total = sections.length;
  if (total === 0) {
    if (words < 300) {
      return check(CAT, "answer-first", "Sections open with a direct answer", 0, "info", 0, "No H2 or H3 sections to measure. Optional on a short page.");
    }
    return check(CAT, "answer-first", "Sections open with a direct answer", 5, "warn", 0, "There are no H2 or H3 sections, so no passage opens with a quotable answer.", {
      fix: fix(
        "Add section headings that each open with a short answer",
        "Engines tend to quote a short, self-contained passage that sits directly under a heading. Long unbroken text is harder for them to lift.",
        "Break the page into sections. Under each heading, open with one or two sentences (under 60 words) that answer the heading directly, then add the detail.",
        "high",
        "moderate",
      ),
    });
  }
  const max = 5;
  const good = sections.filter((s) => s.followedByList || (s.firstParagraphWords >= 20 && s.firstParagraphWords <= 80));
  const long = sections.filter((s) => s.firstParagraphWords > 100);
  const absent = sections.filter((s) => !s.followedByList && !s.firstParagraph);
  const ratio = good.length / total;
  const bad = sections.filter((s) => !good.includes(s));
  const evidence = [
    `${good.length} of ${total} sections open with a concise answer`,
    ...bad.slice(0, 4).map((s) => `"${truncate(s.heading, 50)}": ${s.firstParagraph ? `${s.firstParagraphWords} words in the first paragraph` : "no paragraph directly below"}`),
  ];
  if (ratio >= 0.6) {
    return check(CAT, "answer-first", "Sections open with a direct answer", max, "pass", max, `${good.length} of ${total} sections open with a short, self-contained answer.`, { evidence });
  }
  const example = bad[0] ?? sections[0];
  const snippet = [`<h2>${example.heading}</h2>`, "<p>[Answer the heading directly in one or two sentences, under 60 words.] [Then continue with detail, examples and links.]</p>"].join("\n");
  const detail = long.length > absent.length ? `${long.length} open with a paragraph over 100 words` : absent.length ? `${absent.length} have no paragraph directly under the heading` : "the first paragraphs are too short or too long to quote";
  const points = ratio >= 0.3 ? 3 : good.length === 0 && total >= 3 ? 0 : 1;
  return check(CAT, "answer-first", "Sections open with a direct answer", max, points === 0 ? "fail" : "warn", points, `Only ${good.length} of ${total} sections open with a concise answer; ${detail}.`, {
    evidence,
    fix: fix(
      "Open each section with a short, direct answer",
      "Answer engines favour a passage that answers the heading on its own. A 25 to 60 word answer straight under the heading is the easiest thing for them to extract and cite.",
      `Under each H2 or H3, put the answer in the first one or two sentences (aim for under 60 words), then follow with detail. Start with the heading "${truncate(example.heading, 60)}".`,
      "high",
      "moderate",
      snippet,
    ),
  });
}

function substance(ctx: AuditContext): CheckResult {
  const max = 4;
  const words = ctx.page.facts.wordCount;
  const home = ctx.page.isHome;
  const evidence = [`${words} words of main text (navigation, header and footer excluded)`];
  if (words > 700) {
    return check(CAT, "substance", "Enough useful content", max, "pass", max, `The page has ${words} words of main text, enough to answer questions in depth.`, { evidence });
  }
  const f = fix(
    "Add more useful, specific content",
    "Pages that explain a topic thoroughly give engines more to quote and more reason to trust the source. Thin pages are usually skipped in favour of fuller ones.",
    "Add the information customers ask about before they buy: how it works, pricing or price ranges, who it is for, proof such as case studies or reviews, and answers to common questions. Aim for 700 or more words of genuinely useful text; length for its own sake does not help.",
    words < 300 ? "high" : "low",
    "involved",
  );
  if (words >= 300) {
    return check(CAT, "substance", "Enough useful content", max, "warn", 2, `The page has ${words} words, which is workable but light for a page you want cited.`, { evidence, fix: f });
  }
  if (home) {
    return check(CAT, "substance", "Enough useful content", max, "warn", 1, `The home page has only ${words} words. Home pages are often short, but a little more explanation of what you do helps engines describe you.`, { evidence, fix: { ...f, impact: "medium" } });
  }
  return check(CAT, "substance", "Enough useful content", max, "fail", 0, `The page has only ${words} words, which is too little for engines to quote from.`, { evidence, fix: f });
}

function listsTables(ctx: AuditContext): CheckResult {
  const max = 2;
  if (ctx.page.hasListOrTable) {
    return check(CAT, "lists-tables", "Lists or tables", max, "pass", max, "The page includes a list or table, which engines can lift out cleanly.");
  }
  return check(CAT, "lists-tables", "Lists or tables", max, "warn", 0, "The page has no bulleted or numbered lists and no tables.", {
    fix: fix(
      "Present steps, features or comparisons as a list or table",
      "Lists and tables are easy for engines to extract and reproduce in an answer, and they are easier for visitors to scan.",
      "Turn any run of three or more parallel points (features, steps, pricing tiers, pros and cons) into a bulleted or numbered list. Use a table for comparisons.",
      "low",
      "quick",
      "<ul>\n  <li>First point</li>\n  <li>Second point</li>\n  <li>Third point</li>\n</ul>",
    ),
  });
}

export function contentChecks(ctx: AuditContext): CheckResult[] {
  return [singleH1(ctx), headingHierarchy(ctx), questionHeadings(ctx), faqBlock(ctx), answerFirst(ctx), substance(ctx), listsTables(ctx)];
}
