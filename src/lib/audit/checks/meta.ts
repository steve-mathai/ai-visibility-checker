import type { CheckResult } from "../types";
import type { AuditContext } from "../context";
import { brandName, check, fix, truncate } from "./util";

const CAT = "meta" as const;

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

const SECOND_LEVEL = new Set(["co", "com", "org", "net", "gov", "ac", "edu", "ltd", "plc"]);

/** Approximate registrable domain without a public-suffix list. */
export function registrableDomain(host: string): string {
  const labels = host.toLowerCase().replace(/^www\./, "").split(".");
  if (labels.length <= 2) return labels.join(".");
  const tld = labels[labels.length - 1];
  const sld = labels[labels.length - 2];
  if (tld.length === 2 && SECOND_LEVEL.has(sld)) return labels.slice(-3).join(".");
  return labels.slice(-2).join(".");
}

function normaliseUrlForCompare(u: URL): string {
  const path = u.pathname.replace(/\/+$/, "") || "";
  return `${u.protocol}//${u.hostname.toLowerCase()}${path}${u.search}`;
}

function suggestTitle(ctx: AuditContext): string {
  const f = ctx.page.facts;
  const brand = brandName(ctx);
  const topic = f.h1[0] ?? f.title?.split(/\s+[|\-–—]\s+/)[0] ?? brand;
  const joined = normaliseName2(topic) === normaliseName2(brand) ? topic : `${topic} | ${brand}`;
  return truncate(joined, 60);
}

const normaliseName2 = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");

function suggestDescription(ctx: AuditContext): string {
  const text = ctx.page.facts.textExcerpt;
  const sentences = text.match(/[^.!?]+[.!?]+/g) ?? [text];
  let out = "";
  for (const s of sentences) {
    if ((out + s).trim().length > 155) break;
    out = (out + s).trim() + " ";
  }
  out = out.trim() || truncate(text, 155);
  return truncate(out, 155);
}

function title(ctx: AuditContext): CheckResult {
  const max = 3;
  const t = ctx.page.facts.title;
  if (!t) {
    return check(CAT, "title", "Page title", max, "fail", 0, "The page has no title tag.", {
      fix: fix(
        "Add a page title",
        "The title is the headline engines and searchers see first. It is one of the strongest signals of what the page is about.",
        "Add a title of 30 to 65 characters that names the topic first and your brand last.",
        "high",
        "quick",
        `<title>${esc(suggestTitle(ctx))}</title>`,
      ),
    });
  }
  const len = t.length;
  if (len >= 30 && len <= 65) {
    return check(CAT, "title", "Page title", max, "pass", max, `The title is ${len} characters, a good length.`, { evidence: [t] });
  }
  const short = len < 30;
  return check(CAT, "title", "Page title", max, "warn", len < 15 ? 1 : 2, short ? `The title is only ${len} characters, which is too short to describe the page.` : `The title is ${len} characters; anything over about 65 is usually cut off in results.`, {
    evidence: [t],
    fix: fix(
      short ? "Lengthen the page title" : "Shorten the page title",
      "A title that is too short wastes space to say what the page covers. One that is too long gets truncated, often losing the brand name.",
      `Rewrite the title to 30 to 65 characters, topic first and brand last. A suggestion based on the page is below; adjust it so it reads naturally.`,
      "medium",
      "quick",
      `<title>${esc(suggestTitle(ctx))}</title>`,
    ),
  });
}

function description(ctx: AuditContext): CheckResult {
  const max = 3;
  const d = ctx.page.facts.metaDescription;
  const snippet = `<meta name="description" content="${esc(suggestDescription(ctx))}">`;
  if (!d) {
    return check(CAT, "meta-description", "Meta description", max, "fail", 0, "The page has no meta description.", {
      fix: fix(
        "Add a meta description",
        "The meta description is the summary engines and searchers see under the title. Without one, they pick text from the page at random, which is often a poor summary.",
        "Write 70 to 160 characters that say what the page offers and who it is for. A draft built from the page text is below; edit it before using it.",
        "medium",
        "quick",
        snippet,
      ),
    });
  }
  const len = d.length;
  if (len >= 70 && len <= 160) {
    return check(CAT, "meta-description", "Meta description", max, "pass", max, `The meta description is ${len} characters, a good length.`, { evidence: [d] });
  }
  return check(CAT, "meta-description", "Meta description", max, "warn", 2, len < 70 ? `The meta description is only ${len} characters, too short to summarise the page.` : `The meta description is ${len} characters; text beyond about 160 is usually cut off.`, {
    evidence: [d],
    fix: fix(
      len < 70 ? "Expand the meta description" : "Shorten the meta description",
      "The description is the summary shown under your title. A complete, specific one reads better and is more likely to be reused.",
      "Rewrite it to 70 to 160 characters that say what the page offers and who it is for. A draft built from the page text is below.",
      "low",
      "quick",
      snippet,
    ),
  });
}

function canonical(ctx: AuditContext): CheckResult {
  const max = 3;
  const href = ctx.page.canonicalHref;
  const final = ctx.page.url;
  const tag = `<link rel="canonical" href="${final.origin}${final.pathname}">`;
  if (!href) {
    return check(CAT, "canonical", "Canonical URL", max, "warn", 0, "The page does not declare a canonical (preferred) URL.", {
      fix: fix(
        "Add a canonical link",
        "If the same page can be reached at several addresses (with or without www, with tracking parameters), a canonical link tells engines which one to treat as the original.",
        "Add a canonical link in the page head that points to the full address you want to appear in search.",
        "medium",
        "quick",
        tag,
      ),
    });
  }
  let target: URL | null = null;
  try {
    target = new URL(href);
  } catch {
    target = null;
  }
  if (!target || !/^https?:$/.test(target.protocol)) {
    const abs = new URL(href, final);
    return check(CAT, "canonical", "Canonical URL", max, "warn", 2, "The canonical link is a relative address; some crawlers handle those unreliably.", {
      evidence: [`canonical: ${href}`],
      fix: fix(
        "Use a full address in the canonical link",
        "Absolute canonical addresses (starting with https://) cannot be misread by crawlers.",
        "Replace the relative address with the full one, including https:// and the domain.",
        "low",
        "quick",
        `<link rel="canonical" href="${abs.toString()}">`,
      ),
    });
  }
  const evidence = [`canonical: ${target.toString()}`, `page: ${final.toString()}`];
  if (registrableDomain(target.hostname) !== registrableDomain(final.hostname)) {
    return check(CAT, "canonical", "Canonical URL", max, "fail", 0, `The canonical link points to a different website (${target.hostname}), which tells engines this page is a copy.`, {
      evidence,
      fix: fix(
        "Point the canonical link at this page",
        "A canonical link to another domain asks engines to credit that site instead. This page would be left out of results and AI answers.",
        "Unless this page really is a copy of the other site's content, change the canonical link to this page's own address.",
        "high",
        "quick",
        tag,
      ),
    });
  }
  if (normaliseUrlForCompare(target) !== normaliseUrlForCompare(final)) {
    return check(CAT, "canonical", "Canonical URL", max, "warn", 2, "The canonical link points to a different address than the one audited. That is correct if this page is a variant of the canonical one.", {
      evidence,
      fix: fix(
        "Check the canonical link is intended",
        "If the canonical address differs from the page you want cited, engines will credit the other address instead. This is correct for tracking-parameter or duplicate versions.",
        `If this page should stand on its own, point the canonical link at ${final.toString()}. If it is a duplicate, leave it as it is and make sure the canonical page is the one you want people to find.`,
        "low",
        "quick",
        tag,
      ),
    });
  }
  return check(CAT, "canonical", "Canonical URL", max, "pass", max, "The canonical link is a full address that matches this page.", { evidence });
}

function openGraph(ctx: AuditContext): CheckResult {
  const max = 3;
  const og = ctx.page.og;
  const f = ctx.page.facts;
  const have = { title: !!og["og:title"], description: !!og["og:description"], image: !!og["og:image"] };
  const count = Number(have.title) + Number(have.description) + Number(have.image);
  const evidence = Object.entries(have).map(([k, v]) => `og:${k}: ${v ? truncate(og[`og:${k}`], 80) : "missing"}`);
  if (count === 3) {
    return check(CAT, "open-graph", "Open Graph tags", max, "pass", max, "og:title, og:description and og:image are all set.", { evidence });
  }
  const lines: string[] = [];
  if (!have.title) lines.push(`<meta property="og:title" content="${esc(f.title ?? brandName(ctx))}">`);
  if (!have.description) lines.push(`<meta property="og:description" content="${esc(f.metaDescription ?? suggestDescription(ctx))}">`);
  if (!have.image) lines.push(`<meta property="og:image" content="${ctx.page.firstImage ?? `${ctx.page.url.origin}/og-image.jpg`}">`);
  const missing = [!have.title && "og:title", !have.description && "og:description", !have.image && "og:image"].filter(Boolean).join(", ");
  return check(CAT, "open-graph", "Open Graph tags", max, "warn", count, `Open Graph tags are missing: ${missing}.`, {
    evidence,
    fix: fix(
      "Add the missing Open Graph tags",
      "Open Graph tags give link previews, social networks and some AI tools a clean title, summary and image for the page instead of making them guess.",
      `Add the tags below to the page head.${!have.image && !ctx.page.firstImage ? " Replace the image address with a real image, ideally 1200 by 630 pixels." : ""} Most SEO plugins have fields for these.`,
      "medium",
      "quick",
      lines.join("\n"),
    ),
  });
}

function langViewport(ctx: AuditContext): CheckResult {
  const max = 1;
  const lang = ctx.page.facts.lang;
  const vp = ctx.page.viewport;
  const evidence = [`html lang: ${lang ?? "missing"}`, `viewport: ${vp ?? "missing"}`];
  if (lang && vp) {
    return check(CAT, "lang-viewport", "Language and mobile viewport", max, "pass", max, `The page declares its language (${lang}) and a mobile viewport.`, { evidence });
  }
  const lines: string[] = [];
  if (!lang) lines.push('<html lang="en">');
  if (!vp) lines.push('<meta name="viewport" content="width=device-width, initial-scale=1">');
  const missing = [!lang && "the html lang attribute", !vp && "the viewport tag"].filter(Boolean).join(" and ");
  return check(CAT, "lang-viewport", "Language and mobile viewport", max, "warn", 0, `The page is missing ${missing}.`, {
    evidence,
    fix: fix(
      "Add the language and viewport declarations",
      "The language attribute tells engines which audience the page is for. The viewport tag is a basic mobile-friendliness signal.",
      "Add these to the page. Change \"en\" to the right language code if the page is not in English.",
      "low",
      "quick",
      lines.join("\n"),
    ),
  });
}

function twitterCard(ctx: AuditContext): CheckResult {
  const max = 1;
  const card = ctx.page.twitter["twitter:card"];
  if (card) {
    return check(CAT, "twitter-card", "Twitter/X card", max, "pass", max, `A Twitter/X card is set (${card}).`, { evidence: [`twitter:card: ${card}`] });
  }
  return check(CAT, "twitter-card", "Twitter/X card", max, "warn", 0, "No Twitter/X card tag was found.", {
    fix: fix(
      "Add a Twitter/X card tag",
      "This only affects how links look when shared on X. It has little effect on AI answers, so treat it as a finishing touch.",
      "Add the tag below. X will reuse your Open Graph title, description and image for the rest.",
      "low",
      "quick",
      '<meta name="twitter:card" content="summary_large_image">',
    ),
  });
}

export function metaChecks(ctx: AuditContext): CheckResult[] {
  return [title(ctx), description(ctx), canonical(ctx), openGraph(ctx), langViewport(ctx), twitterCard(ctx)];
}
