import type { CheckResult } from "../types";
import type { AuditContext } from "../context";
import { check, fix, brandName, findSiteLinks, plural, truncate } from "./util";

const CAT = "crawlability" as const;

// ---------------------------------------------------------------------------
// Robots directive helpers
// ---------------------------------------------------------------------------

const VALUE_DIRECTIVES = ["max-snippet", "max-image-preview", "max-video-preview", "unavailable_after"];

/** Turn "googlebot: noindex, max-snippet: 0" into ["noindex", "max-snippet:0"]. */
export function robotsTokens(raw: string): string[] {
  return raw
    .toLowerCase()
    .replace(/\s*:\s*/g, ":")
    .split(/[\s,]+/)
    .filter(Boolean)
    .map((t) => {
      const idx = t.indexOf(":");
      if (idx === -1) return t;
      const key = t.slice(0, idx);
      return VALUE_DIRECTIVES.includes(key) ? t : t.slice(idx + 1);
    });
}

export function directiveSources(ctx: AuditContext): { source: string; tokens: string[] }[] {
  const out: { source: string; tokens: string[] }[] = [];
  const header = ctx.headers["x-robots-tag"];
  if (header) out.push({ source: `X-Robots-Tag header: ${header}`, tokens: robotsTokens(header) });
  for (const raw of ctx.page.metaRobots) {
    out.push({ source: `meta robots tag: ${raw}`, tokens: robotsTokens(raw) });
  }
  return out;
}

export function isNoindex(ctx: AuditContext): boolean {
  return directiveSources(ctx).some((s) => s.tokens.includes("noindex") || s.tokens.includes("none"));
}

function sentenceList(names: string[]): string {
  if (names.length <= 1) return names.join("");
  return names.slice(0, -1).join(", ") + " and " + names[names.length - 1];
}

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------

function answerBots(ctx: AuditContext): CheckResult {
  const relevant = ctx.bots.filter((b) => b.purpose !== "training");
  const answer = relevant.filter((b) => b.purpose === "answer");
  const blocked = relevant.filter((b) => !b.allowed);
  const googleBlocked = blocked.some((b) => b.bot === "Googlebot");
  const bingBlocked = blocked.some((b) => b.bot === "Bingbot");
  const allAnswerBlocked = answer.length > 0 && answer.every((b) => !b.allowed);
  const max = 12;

  const evidence = relevant.map((b) => `${b.bot} (${b.operator}): ${b.allowed ? "allowed" : "blocked"} - ${b.rule}`);
  if (ctx.robots.status === "missing") evidence.unshift("No robots.txt found: every crawler is allowed by default.");

  if (!blocked.length) {
    const summary =
      ctx.robots.status === "found"
        ? `robots.txt lets all ${answer.length} AI answer bots and both search crawlers (Googlebot, Bingbot) fetch this page.`
        : "No robots.txt rules block AI answer bots or search crawlers, so all of them can fetch this page.";
    return check(CAT, "robots-answer-bots", "AI answer bots can crawl the page", max, "pass", max, summary, { evidence });
  }

  const points = Math.round((max * (relevant.length - blocked.length)) / relevant.length);
  const failed = googleBlocked || bingBlocked || allAnswerBlocked;
  const names = blocked.map((b) => b.bot);
  const lines = blocked.flatMap((b) => [`User-agent: ${b.bot}`, "Allow: /", ""]);
  const snippet = [
    "# Let AI answer and search crawlers read this site",
    ...lines,
  ]
    .join("\n")
    .trimEnd();

  let summary: string;
  if (allAnswerBlocked && (googleBlocked || bingBlocked)) {
    summary = `robots.txt blocks every AI answer bot and ${googleBlocked && bingBlocked ? "both Googlebot and Bingbot" : googleBlocked ? "Googlebot" : "Bingbot"}, so AI engines cannot fetch this page.`;
  } else if (allAnswerBlocked) {
    summary = "robots.txt blocks all six AI answer bots, so ChatGPT search, Perplexity and Claude cannot fetch this page to cite it.";
  } else if (googleBlocked || bingBlocked) {
    const which = googleBlocked && bingBlocked ? "Googlebot and Bingbot" : googleBlocked ? "Googlebot" : "Bingbot";
    summary = `robots.txt blocks ${which}${googleBlocked ? ", which also feeds Google AI Overviews" : ", which feeds Copilot and ChatGPT search"}. Blocked: ${sentenceList(names)}.`;
  } else {
    summary = `robots.txt blocks ${plural(blocked.length, "AI crawler")}: ${sentenceList(names)}.`;
  }

  return check(CAT, "robots-answer-bots", "AI answer bots can crawl the page", max, failed ? "fail" : "warn", failed ? Math.min(points, 3) : points, summary, {
    evidence,
    fix: fix(
      `Allow ${sentenceList(names)} in robots.txt`,
      "These crawlers are how ChatGPT search, Perplexity, Claude and Google or Bing find pages to quote. If they are blocked, the page cannot appear as a cited source. Some publishers block them on purpose as part of licensing deals; if that is your case, keep the block, but count the lost citations as part of the cost.",
      "Open your robots.txt file and either delete the Disallow lines that match these bots or add the groups below. A group that names a bot replaces the general \"User-agent: *\" rules for that bot, so repeat any Disallow lines you still want, such as /admin/.",
      "high",
      "quick",
      snippet,
    ),
  });
}

function trainingBots(ctx: AuditContext): CheckResult {
  const training = ctx.bots.filter((b) => b.purpose === "training");
  const blocked = training.filter((b) => !b.allowed);

  const googleExtBlocked = blocked.some((b) => b.bot === "Google-Extended");

  const parts: string[] = [];
  if (!blocked.length) {
    parts.push(`All ${training.length} AI training crawlers are allowed.`);
  } else {
    parts.push(`Blocked training crawlers: ${sentenceList(blocked.map((b) => b.bot))}.`);
  }
  parts.push("Blocking these is a business choice and does not stop ChatGPT, Perplexity or Claude from citing the page.");

  const evidence = training.map((b) => `${b.bot} (${b.operator}): ${b.allowed ? "allowed" : "blocked"} - ${b.rule}`);
  if (googleExtBlocked) {
    evidence.push("Google-Extended is blocked. This does not affect Google AI Overviews or ordinary Google Search; those are governed by Googlebot.");
  } else {
    evidence.push("Note: Google-Extended only controls Gemini training and grounding. Google AI Overviews are governed by Googlebot.");
  }
  return check(CAT, "robots-training-bots", "AI training crawlers (for information)", 0, "info", 0, parts.join(" "), { evidence });
}

function indexable(ctx: AuditContext): CheckResult {
  const max = 8;
  const sources = directiveSources(ctx);
  const noindexSrc = sources.filter((s) => s.tokens.includes("noindex") || s.tokens.includes("none"));
  const snippetSrc = sources.filter((s) => s.tokens.includes("nosnippet") || s.tokens.includes("max-snippet:0"));
  const evidence = sources.map((s) => s.source);

  if (noindexSrc.length) {
    return check(CAT, "indexable", "Page is allowed to be indexed", max, "fail", 0, "The page tells search engines not to index it (noindex), so it will not be used in search results or AI answers.", {
      evidence,
      fix: fix(
        "Remove the noindex directive",
        "A noindex instruction asks Google, Bing and AI search crawlers to leave the page out entirely. Nothing else on this report matters while it is in place.",
        "Delete the noindex value from the robots meta tag in the page head, or from the X-Robots-Tag response header if your server sends one. In WordPress, also check Settings > Reading for \"Discourage search engines from indexing this site\". Your SEO plugin may have a per-page noindex switch too.",
        "high",
        "quick",
        '<meta name="robots" content="index, follow">',
      ),
    });
  }
  if (snippetSrc.length) {
    return check(CAT, "indexable", "Page is allowed to be indexed", max, "warn", 4, "The page can be indexed, but a nosnippet or max-snippet:0 rule stops search engines from showing or quoting its text.", {
      evidence,
      fix: fix(
        "Remove the nosnippet restriction",
        "Google uses the same snippet permissions for AI Overviews. With nosnippet in place, the page can rank but its text will not be quoted in an AI answer.",
        "Remove nosnippet or max-snippet:0 from the robots meta tag or X-Robots-Tag header. If you only want to hide specific passages, mark those with a data-nosnippet attribute instead.",
        "high",
        "quick",
        '<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large">',
      ),
    });
  }
  return check(CAT, "indexable", "Page is allowed to be indexed", max, "pass", max, "No noindex or nosnippet instructions found in the page or response headers.", { evidence });
}

export interface ShellAnalysis {
  words: number;
  signals: string[];
  strong: boolean;
  isShell: boolean;
  isPartial: boolean;
}

export function analyseShell(ctx: AuditContext): ShellAnalysis {
  const p = ctx.page;
  const words = p.facts.wordCount;
  const signals: string[] = [];
  if (p.emptyRootSelector) signals.push(`empty ${p.emptyRootSelector} container`);
  if (p.noscriptNeedsJs) signals.push("noscript message asking for JavaScript");
  if (p.scriptCount >= 6) signals.push(`${p.scriptCount} script tags`);
  const strong = !!p.emptyRootSelector || p.noscriptNeedsJs;
  const isShell = words < 80 && signals.length > 0;
  const isPartial = !isShell && words >= 80 && words <= 200 && (strong || p.scriptCount >= 12);
  return { words, signals, strong, isShell, isPartial };
}

function serverRendered(ctx: AuditContext): CheckResult {
  const max = 6;
  const a = analyseShell(ctx);
  const evidence = [`${a.words} words of readable text in the raw HTML`, ...a.signals];
  const f = fix(
    "Make the page text part of the HTML the server sends",
    "Most AI crawlers read the raw HTML and do not run JavaScript. If your text is drawn in the browser, they see an empty page and have nothing to quote.",
    "Ask your developer to server-render or pre-build the key pages (Next.js, Nuxt, Astro and most site builders can do this). To test it, open the page, choose View Source (not Inspect) and search for a sentence from the page. If it is missing there, crawlers cannot see it either. You can also run the command below.",
    "high",
    "involved",
    `curl -s ${ctx.page.url.origin}${ctx.page.url.pathname} | grep -i "a sentence from your page"`,
  );
  if (ctx.truncated && (a.isShell || a.isPartial)) {
    // Text may sit past the byte cap, so a low word count proves nothing here.
    return check(CAT, "server-rendered", "Content is visible without JavaScript", max, "warn", 3, `The page HTML is too large to read in full, and the part we read holds only ${a.words} words. Check that the main text is not buried after megabytes of scripts or inline data.`, { evidence: [...evidence, "Page HTML was cut off at the size limit"], fix: f });
  }
  if (a.isShell) {
    return check(CAT, "server-rendered", "Content is visible without JavaScript", max, "fail", 0, `Only ${a.words} words are in the raw HTML and the page looks like a JavaScript app shell, so AI crawlers will see almost nothing.`, { evidence, fix: f });
  }
  if (a.isPartial) {
    return check(CAT, "server-rendered", "Content is visible without JavaScript", max, "warn", 3, `The raw HTML holds only ${a.words} words and shows signs of a JavaScript-rendered page, so crawlers may be missing content.`, { evidence, fix: f });
  }
  return check(CAT, "server-rendered", "Content is visible without JavaScript", max, "pass", max, `${a.words} words of text are present in the raw HTML, so crawlers that skip JavaScript can still read the page.`, { evidence });
}

function llmsTxt(ctx: AuditContext): CheckResult {
  const max = 3;
  const origin = ctx.page.url.origin;
  const evidence = [ctx.llms.found ? `${origin}/llms.txt returned ${ctx.llms.httpStatus ?? 200}` : ctx.llms.note ?? `${origin}/llms.txt not found`];
  if (ctx.llms.found) {
    return check(CAT, "llms-txt", "llms.txt file", max, "pass", max, "An llms.txt file is published at the site root.", { evidence });
  }
  const brand = brandName(ctx);
  const desc = ctx.page.facts.metaDescription ?? truncate(ctx.page.facts.textExcerpt, 160);
  const links = findSiteLinks(ctx);
  const lines = [`# ${brand}`, "", `> ${desc || `Official website of ${brand}.`}`, "", "## Key pages", "", `- [Home](${origin}/): ${ctx.page.facts.title ?? brand}`];
  if (links.about) lines.push(`- [About](${links.about.url}): Who we are and what we do`);
  if (links.contact) lines.push(`- [Contact](${links.contact.url}): How to reach us`);
  if (ctx.page.url.pathname !== "/") lines.push(`- [${truncate(ctx.page.facts.h1[0] ?? ctx.page.facts.title ?? "This page", 60)}](${ctx.page.url.toString()}): ${truncate(desc, 90)}`);
  return check(CAT, "llms-txt", "llms.txt file", max, "warn", 0, "No llms.txt file was found at the site root.", {
    evidence,
    fix: fix(
      "Add a short llms.txt file",
      "llms.txt is an emerging proposal for giving AI tools a plain-text map of your site. No major AI engine has confirmed that it reads it, so treat it as cheap insurance rather than a ranking factor.",
      `Create a plain text file and publish it at ${origin}/llms.txt. List your most important pages with a one-line description each. Make sure the URL returns the text file itself, not your site's 404 page.`,
      "low",
      "quick",
      lines.join("\n"),
    ),
  });
}

function sitemap(ctx: AuditContext): CheckResult {
  const max = 3;
  const origin = ctx.page.url.origin;
  if (ctx.sitemap.found) {
    return check(CAT, "sitemap", "XML sitemap", max, "pass", max, `A sitemap was found${ctx.sitemap.via === "robots.txt" ? " (declared in robots.txt)" : ` at ${ctx.sitemap.url ?? ctx.sitemap.via}`}.`, {
      evidence: [ctx.sitemap.url ?? `via ${ctx.sitemap.via}`],
    });
  }
  return check(CAT, "sitemap", "XML sitemap", max, "warn", 0, "No sitemap was declared in robots.txt or found at /sitemap.xml.", {
    evidence: [`Tried ${origin}/sitemap.xml and ${origin}/sitemap_index.xml`, "No Sitemap line in robots.txt"],
    fix: fix(
      "Publish an XML sitemap and list it in robots.txt",
      "A sitemap tells Google, Bing and other crawlers which pages exist and when they changed, which helps new and updated pages get found sooner.",
      "Most site builders and SEO plugins generate a sitemap automatically; switch it on, then add the Sitemap line below to robots.txt.",
      "medium",
      "quick",
      `Sitemap: ${origin}/sitemap.xml`,
    ),
  });
}

function httpStatus(ctx: AuditContext): CheckResult {
  const max = 3;
  const u = ctx.page.url;
  const status = ctx.page.facts.statusCode;
  const https = u.protocol === "https:";
  const evidence = [`Final URL: ${u.toString()}`, `Status: ${status}`];
  if (ctx.redirects.length) evidence.push(`Redirects: ${ctx.redirects.length}`);
  if (https && status === 200) {
    return check(CAT, "https-status", "Secure (HTTPS) and loads normally", max, "pass", max, "The page is served over HTTPS and returns a normal 200 response.", { evidence });
  }
  const points = (https ? 2 : 0) + (status === 200 ? 1 : 0);
  const problems: string[] = [];
  if (!https) problems.push("served over plain HTTP");
  if (status !== 200) problems.push(`returned status ${status} instead of 200`);
  return check(CAT, "https-status", "Secure (HTTPS) and loads normally", max, "warn", points, `The page is ${problems.join(" and ")}.`, {
    evidence,
    fix: fix(
      !https ? "Serve the site over HTTPS" : "Make the page return a plain 200 response",
      "Search engines prefer secure pages, and browsers warn visitors about plain HTTP. Unusual status codes can make crawlers skip or re-check the page.",
      !https
        ? "Install an SSL certificate (most hosts offer one free) and redirect every http:// address to its https:// version."
        : "Check why the address does not return a standard 200 response, and link to the final address directly rather than through a redirect.",
      "medium",
      "moderate",
    ),
  });
}

export function crawlabilityChecks(ctx: AuditContext): CheckResult[] {
  return [answerBots(ctx), trainingBots(ctx), indexable(ctx), serverRendered(ctx), llmsTxt(ctx), sitemap(ctx), httpStatus(ctx)];
}
