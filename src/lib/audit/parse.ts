import * as cheerio from "cheerio";
import type { CheerioAPI } from "cheerio";
import type { PageFacts } from "./types";
import { asString, isNode, isOrgNode, shortType, typesOf, type JsonLdNode } from "./schema";

export interface Section {
  level: 2 | 3;
  heading: string;
  /** First paragraph after the heading, or null when none was found. */
  firstParagraph: string | null;
  firstParagraphWords: number;
  /** The heading is followed straight away by a list or table (counts as extractable). */
  followedByList: boolean;
}

export interface ParsedLink {
  href: URL;
  text: string;
}

/** Hard caps on page-controlled collections, so a hostile page cannot make later checks expensive. */
export const LIMITS = {
  sections: 1000,
  headings: 2000,
  links: 5000,
  phones: 200,
  types: 200,
  jsonLdBlocks: 50,
  /** Above this many elements the clone-based text extraction is skipped. */
  elements: 150_000,
} as const;

export interface ParsedPage {
  $: CheerioAPI;
  /** Non-fatal notes from parsing (oversized page, truncated collections). */
  parseWarnings: string[];
  url: URL;
  facts: PageFacts;
  /** Body text minus script/style/noscript/svg/nav/footer/header, whitespace-collapsed. */
  visibleText: string;
  /** Body text including nav/footer/header (still without script/style). */
  fullText: string;
  viewport: string | null;
  canonicalHref: string | null;
  metaByName: Record<string, string>;
  og: Record<string, string>;
  twitter: Record<string, string>;
  /** Raw content of meta robots / googlebot / bingbot tags, lower-cased, e.g. "noindex, nofollow". */
  metaRobots: string[];
  jsonLd: {
    blocks: number;
    invalid: number;
    errors: string[];
    /** Top-level nodes (including members of @graph and mainEntity). */
    topNodes: JsonLdNode[];
    /** Every typed node at any depth, e.g. a nested publisher. */
    allNodes: JsonLdNode[];
  };
  idMap: Map<string, JsonLdNode>;
  microdataTypes: string[];
  scriptCount: number;
  emptyRootSelector: string | null;
  noscriptNeedsJs: boolean;
  links: ParsedLink[];
  socialLinks: string[];
  telLinks: string[];
  textPhones: string[];
  hasAddressElement: boolean;
  logoCandidate: string | null;
  firstImage: string | null;
  author: string | null;
  publishedTime: string | null;
  sections: Section[];
  detailsCount: number;
  hasFaqHeading: boolean;
  hasListOrTable: boolean;
  isHome: boolean;
}

const clean = (s: string) => s.replace(/\s+/g, " ").trim();

function countWords(text: string): number {
  if (!text) return 0;
  return text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

const BLOCK_SELECTOR =
  "p,div,li,ul,ol,h1,h2,h3,h4,h5,h6,br,tr,td,th,table,section,article,main,aside,blockquote,pre,dd,dt,dl,figure,figcaption,summary,details,form,hr";

interface WalkNode {
  type: string;
  data?: string;
  name?: string;
  attribs?: Record<string, string>;
  children?: WalkNode[];
}

const SKIP_ALWAYS = new Set(["script", "style", "noscript", "svg", "template"]);
const SKIP_CHROME = new Set(["nav", "footer", "header"]);
const BLOCK_TAGS = new Set(BLOCK_SELECTOR.split(","));

/**
 * Both text variants in ONE linear walk of <body>, with no clone and no DOM mutation (inserting a node
 * after every block element is quadratic for a body with tens of thousands of siblings).
 * fullText skips non-content tags and [hidden]; visibleText also skips nav/footer/header.
 * A space follows every block element, as the old clone-and-insert approach produced.
 */
function extractTexts($: CheerioAPI): { visibleText: string; fullText: string } {
  const root = $("body").get(0) as unknown as WalkNode | undefined;
  const full: string[] = [];
  const visible: string[] = [];
  if (root) {
    // Stack entries: [node, insideChrome, exiting]
    const stack: [WalkNode, boolean, boolean][] = [[root, false, false]];
    while (stack.length) {
      const [node, chrome, exiting] = stack.pop() as [WalkNode, boolean, boolean];
      if (node.type === "text") {
        const t = node.data ?? "";
        full.push(t);
        if (!chrome) visible.push(t);
        continue;
      }
      const isEl = node.type === "tag" || node.type === "script" || node.type === "style";
      if (!isEl && node !== root) continue; // comments, directives, cdata
      const name = (node.name ?? "").toLowerCase();
      if (exiting) {
        if (BLOCK_TAGS.has(name)) {
          full.push(" ");
          if (!chrome) visible.push(" ");
        }
        continue;
      }
      if (node !== root && (SKIP_ALWAYS.has(name) || (node.attribs && "hidden" in node.attribs))) continue;
      const inChrome = chrome || (node !== root && SKIP_CHROME.has(name));
      if (node !== root) stack.push([node, chrome, true]);
      const kids = node.children ?? [];
      for (let i = kids.length - 1; i >= 0; i--) stack.push([kids[i], inChrome, false]);
    }
  }
  return { visibleText: clean(visible.join("")), fullText: clean(full.join("")) };
}

/** Cheap fallback for huge DOMs: text of content-bearing tags only, no clone. */
function extractTextsLight($: CheerioAPI): { visibleText: string; fullText: string } {
  const parts: string[] = [];
  $("p,li,h1,h2,h3,h4,h5,h6").each((i, el) => {
    if (i >= 5000) return false;
    parts.push($(el).text());
  });
  const text = clean(parts.join(" "));
  return { visibleText: text, fullText: text };
}

const SOCIAL_RE =
  /^(?:[\w-]+\.)?(facebook\.com|linkedin\.com|twitter\.com|x\.com|instagram\.com|youtube\.com|github\.com|tiktok\.com|pinterest\.com|crunchbase\.com|wikipedia\.org|wikidata\.org|threads\.net|bsky\.app)$/i;

function isProfileLink(u: URL): boolean {
  if (!SOCIAL_RE.test(u.hostname)) return false;
  const p = u.pathname.toLowerCase();
  if (p === "/" || p === "") return false;
  if (/(sharer|share|intent|dialog|login|signup|hashtag|search|plugins)/.test(p)) return false;
  if (/linkedin\.com$/.test(u.hostname.replace(/^www\./, "")) && !/^\/(company|in|school|showcase)\//.test(p)) return false;
  return true;
}

const ROOT_SELECTORS = ["#root", "#app", "#__next", "#__nuxt", "#___gatsby", "#svelte", "#q-app"];

const PHONE_RE = /(?:\+\d{1,3}[\s.-]?)?(?:\(\d{2,4}\)|\d{2,4})[\s.-]\d{3,4}[\s.-]\d{3,4}/g;

export function digitsOnly(s: string): string {
  return s.replace(/\D/g, "");
}

function walkJsonLd(
  value: unknown,
  depth: number,
  top: boolean,
  topNodes: JsonLdNode[],
  allNodes: JsonLdNode[],
): void {
  if (depth > 8) return;
  if (Array.isArray(value)) {
    for (const v of value) walkJsonLd(v, depth + 1, top, topNodes, allNodes);
    return;
  }
  if (!isNode(value)) return;
  const graph = value["@graph"];
  if (value["@type"] !== undefined) {
    allNodes.push(value);
    if (top) topNodes.push(value);
  }
  if (graph !== undefined) walkJsonLd(graph, depth + 1, top, topNodes, allNodes);
  const own = typesOf(value);
  const promoteMainEntity = !own.some((t) => t === "FAQPage" || t === "QAPage" || t === "HowTo" || t === "ItemList");
  for (const [k, v] of Object.entries(value)) {
    if (k === "@graph" || k.startsWith("@")) continue;
    if (v !== null && typeof v === "object") {
      // mainEntity stays "top" so a Product/FAQPage wrapped in a WebPage is recognised
      walkJsonLd(v, depth + 1, top && k === "mainEntity" && promoteMainEntity, topNodes, allNodes);
    }
  }
}

function firstAfter($: CheerioAPI, headingEl: Parameters<CheerioAPI>[0]): { text: string | null; list: boolean } {
  let node = $(headingEl);
  for (let climb = 0; climb < 3; climb++) {
    let sib = node.next();
    let steps = 0;
    while (sib.length && steps < 8) {
      steps++;
      const tag = (sib.prop("tagName") as string | undefined)?.toLowerCase() ?? "";
      if (/^h[1-6]$/.test(tag)) return { text: null, list: false };
      if (tag === "p") {
        const t = clean(sib.text());
        if (t) return { text: t, list: false };
      } else if (tag === "ul" || tag === "ol" || tag === "table" || tag === "dl") {
        return { text: null, list: true };
      } else if (tag !== "script" && tag !== "style") {
        const inner = sib.find("p,h1,h2,h3,h4,h5,h6,ul,ol,table").first();
        if (inner.length) {
          const it = (inner.prop("tagName") as string).toLowerCase();
          if (it === "p") {
            const t = clean(inner.text());
            if (t) return { text: t, list: false };
          } else if (/^h[1-6]$/.test(it)) {
            return { text: null, list: false };
          } else {
            return { text: null, list: true };
          }
        }
      }
      sib = sib.next();
    }
    const parent = node.parent();
    const ptag = (parent.prop("tagName") as string | undefined)?.toLowerCase() ?? "body";
    if (!parent.length || ptag === "body" || ptag === "main" || ptag === "html") break;
    node = parent;
  }
  return { text: null, list: false };
}

function brandFromTitle(title: string | null, isHome: boolean): string | null {
  if (!title) return null;
  const parts = title.split(/\s+[|\-–—·:]\s+|\s*[|–—·]\s*/).map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  return isHome ? parts[0] : parts[parts.length - 1];
}

export function titleSegments(title: string | null): string[] {
  if (!title) return [];
  return title.split(/\s+[|\-–—·:]\s+|\s*[|–—·]\s*/).map((p) => p.trim()).filter(Boolean);
}

export function parsePage(html: string, finalUrl: string, statusCode: number): ParsedPage {
  const $ = cheerio.load(html);
  const url = new URL(finalUrl);
  const isHome = url.pathname === "/" || /^\/index\.(html?|php)$/i.test(url.pathname);

  // ---- meta ----
  const metaByName: Record<string, string> = {};
  const og: Record<string, string> = {};
  const twitter: Record<string, string> = {};
  $("meta").each((_, el) => {
    const name = ($(el).attr("name") ?? "").trim().toLowerCase();
    const prop = ($(el).attr("property") ?? "").trim().toLowerCase();
    const content = ($(el).attr("content") ?? "").trim();
    if (!content) return;
    if (name) {
      if (name.startsWith("twitter:")) twitter[name] = content;
      else if (!(name in metaByName)) metaByName[name] = content;
    }
    if (prop) {
      if (prop.startsWith("og:") || prop.startsWith("article:")) {
        if (!(prop in og)) og[prop] = content;
      } else if (prop.startsWith("twitter:")) {
        twitter[prop] = content;
      }
    }
  });
  const metaRobots: string[] = [];
  for (const n of ["robots", "googlebot", "bingbot"]) {
    const v = metaByName[n];
    if (v) metaRobots.push(v.toLowerCase());
  }

  const titleRaw = clean($("head > title").first().text() || $("title").first().text());
  const title = titleRaw || null;
  const metaDescription = metaByName["description"] ? clean(metaByName["description"]) : null;
  const canonicalHref = ($('link[rel~="canonical" i]').first().attr("href") ?? "").trim() || null;
  const viewport = metaByName["viewport"] ?? null;
  const lang = ($("html").attr("lang") ?? "").trim() || null;

  // ---- text ----
  const parseWarnings: string[] = [];
  let texts: { visibleText: string; fullText: string };
  if ($("*").length > LIMITS.elements) {
    parseWarnings.push("The page was too large to analyse fully, so some checks may undercount.");
    texts = extractTextsLight($);
  } else {
    texts = extractTexts($);
  }
  const { visibleText, fullText } = texts;
  let capped = false;
  const wordCount = countWords(visibleText);

  // ---- headings ----
  const headings: { level: number; text: string }[] = [];
  $("h1,h2,h3,h4,h5,h6").each((_, el) => {
    if (headings.length >= LIMITS.headings) {
      capped = true;
      return false;
    }
    const text = clean($(el).text());
    if (!text) return;
    const level = Number((el as { tagName: string }).tagName.slice(1));
    headings.push({ level, text });
  });
  const h1 = headings.filter((h) => h.level === 1).map((h) => h.text);

  // ---- sections (answer-first analysis) ----
  const sections: Section[] = [];
  $("h2,h3").each((_, el) => {
    if (sections.length >= LIMITS.sections) {
      capped = true;
      return false;
    }
    const text = clean($(el).text());
    if (!text) return;
    if ($(el).closest("nav,footer,header,aside").length) return;
    const level = (el as { tagName: string }).tagName === "h2" ? 2 : 3;
    const { text: para, list } = firstAfter($, el);
    sections.push({
      level,
      heading: text,
      firstParagraph: para,
      firstParagraphWords: para ? countWords(para) : 0,
      followedByList: list,
    });
  });

  // ---- JSON-LD ----
  const topNodes: JsonLdNode[] = [];
  const allNodes: JsonLdNode[] = [];
  let blocks = 0;
  let invalid = 0;
  const errors: string[] = [];
  $('script[type="application/ld+json" i]').each((_, el) => {
    if (blocks >= LIMITS.jsonLdBlocks) {
      capped = true;
      return false;
    }
    blocks++;
    const raw = ($(el).html() ?? "").trim();
    try {
      const parsed: unknown = JSON.parse(raw.replace(/^﻿/, ""));
      walkJsonLd(parsed, 0, true, topNodes, allNodes);
    } catch (e) {
      invalid++;
      errors.push(`Block ${blocks}: ${(e as Error).message.slice(0, 120)}`);
    }
  });
  const idMap = new Map<string, JsonLdNode>();
  for (const n of allNodes) {
    const id = n["@id"];
    if (typeof id === "string") idMap.set(id, n);
  }

  // ---- microdata ----
  const microdataSet = new Set<string>();
  $("[itemscope][itemtype]").each((_, el) => {
    if (microdataSet.size >= LIMITS.types) {
      capped = true;
      return false;
    }
    const t = shortType($(el).attr("itemtype") ?? "");
    if (t) microdataSet.add(t);
  });
  const microdataTypes = [...microdataSet];

  const schemaSet = new Set<string>();
  for (const n of topNodes) {
    for (const t of typesOf(n)) {
      if (schemaSet.size >= LIMITS.types) {
        capped = true;
        break;
      }
      schemaSet.add(t);
    }
  }
  for (const t of microdataTypes) if (schemaSet.size < LIMITS.types) schemaSet.add(t);
  const schemaTypes = [...schemaSet];

  // ---- links ----
  let base = url;
  const baseHref = $("base[href]").first().attr("href");
  if (baseHref) {
    try {
      base = new URL(baseHref, url);
    } catch {
      /* ignore */
    }
  }
  const links: ParsedLink[] = [];
  const telLinks: string[] = [];
  const socialSet = new Set<string>();
  $("a[href]").each((_, el) => {
    if (links.length >= LIMITS.links) {
      capped = true;
      return false;
    }
    const href = ($(el).attr("href") ?? "").trim();
    if (!href || href.startsWith("#") || /^javascript:/i.test(href)) return;
    if (/^tel:/i.test(href)) {
      if (telLinks.length < LIMITS.phones) {
        try {
          telLinks.push(decodeURIComponent(href.slice(4)));
        } catch {
          telLinks.push(href.slice(4)); // malformed % escape: keep the raw text rather than fail the audit
        }
      }
      return;
    }
    if (/^mailto:/i.test(href)) return;
    try {
      const u = new URL(href, base);
      if (u.protocol !== "http:" && u.protocol !== "https:") return;
      links.push({ href: u, text: clean($(el).text() || $(el).attr("aria-label") || $(el).attr("title") || "") });
      if (isProfileLink(u)) {
        u.hash = "";
        u.search = "";
        socialSet.add(u.toString().replace(/\/$/, ""));
      }
    } catch {
      /* ignore */
    }
  });

  // ---- shell signals ----
  const scriptCount = $("script").length;
  let emptyRootSelector: string | null = null;
  for (const sel of ROOT_SELECTORS) {
    const el = $(sel).first();
    if (!el.length) continue;
    const t = clean(el.clone().find("script,style,noscript").remove().end().text());
    if (t.length < 40) {
      emptyRootSelector = sel;
      break;
    }
  }
  const noscriptNeedsJs = $("noscript")
    .toArray()
    .some((el) => /(enable|requires?|need).{0,40}javascript|javascript.{0,40}(required|disabled|enabled)/i.test($(el).text()));

  // ---- contact signals ----
  const phoneSet = new Set<string>();
  for (const m of fullText.matchAll(PHONE_RE)) {
    if (phoneSet.size >= LIMITS.phones) {
      capped = true;
      break;
    }
    const d = digitsOnly(m[0]);
    if (d.length >= 10 && d.length <= 13) phoneSet.add(m[0].trim());
  }
  const textPhones = [...phoneSet];
  const hasAddressElement = $("address, [itemprop='streetAddress'], [itemprop='address']").length > 0;

  // ---- logo / image candidates ----
  const abs = (s: string | undefined): string | null => {
    if (!s) return null;
    try {
      return new URL(s, base).toString();
    } catch {
      return null;
    }
  };
  let logoCandidate: string | null = null;
  $("img").each((_, el) => {
    if (logoCandidate) return;
    const blob = `${$(el).attr("src") ?? ""} ${$(el).attr("alt") ?? ""} ${$(el).attr("class") ?? ""} ${$(el).attr("id") ?? ""}`.toLowerCase();
    if (/logo/.test(blob) && $(el).attr("src") && !/^data:/.test($(el).attr("src") ?? "")) {
      logoCandidate = abs($(el).attr("src"));
    }
  });
  if (!logoCandidate) {
    logoCandidate =
      abs($('link[rel="apple-touch-icon"]').first().attr("href")) ??
      abs($('link[rel~="icon"][sizes]').first().attr("href"));
  }
  let firstImage: string | null = null;
  $("main img[src], article img[src], body img[src]").each((_, el) => {
    if (firstImage) return;
    const src = $(el).attr("src") ?? "";
    if (!src || /^data:/.test(src) || /logo|icon|sprite|pixel|avatar/i.test(src)) return;
    firstImage = abs(src);
  });

  // ---- author / dates ----
  let author: string | null = null;
  const authorFromNodes = (): string | null => {
    for (const n of allNodes) {
      if (n.author !== undefined) {
        const a = asString(isNode(n.author) && typeof n.author["@id"] === "string" && idMap.get(n.author["@id"]) ? idMap.get(n.author["@id"]) : n.author);
        if (a) return a;
      }
    }
    return null;
  };
  author = authorFromNodes() ?? (metaByName["author"] ? clean(metaByName["author"]) : null);
  if (!author) {
    const sel = $('[rel~="author"], [itemprop="author"], .author, .byline, [class*="author-name"], [class*="byline"]').first();
    const t = clean(sel.text());
    if (sel.length && t && t.length <= 80) author = t.replace(/^by\s+/i, "");
  }
  if (!author) {
    const m = fullText.slice(0, 6000).match(/\bBy\s+([A-Z][\w'’.-]+(?:\s+[A-Z][\w'’.-]+){0,3})/);
    if (m) author = m[1];
  }
  const publishedTime =
    og["article:published_time"] ??
    ($("time[datetime]").first().attr("datetime") ?? null) ??
    (allNodes.map((n) => asString(n.datePublished)).find(Boolean) ?? null);

  // ---- FAQ / list signals ----
  const detailsCount = $("details > summary").length;
  const hasFaqHeading = headings.some((h) => /\bfaq\b|frequently asked/i.test(h.text));
  const hasListOrTable =
    $("table").filter((_, el) => $(el).closest("nav,header,footer").length === 0).length > 0 ||
    $("ul,ol")
      .filter((_, el) => $(el).closest("nav,header,footer,aside").length === 0 && $(el).children("li").length >= 3)
      .length > 0;

  // ---- business name ----
  const orgNode = allNodes.find((n) => isOrgNode(n) && asString(n.name));
  const businessName =
    (orgNode ? asString(orgNode.name) : null) ??
    (og["og:site_name"] ? clean(og["og:site_name"]) : null) ??
    brandFromTitle(title, isHome);

  const facts: PageFacts = {
    finalUrl,
    statusCode,
    title,
    metaDescription,
    h1,
    headings,
    wordCount,
    textExcerpt: visibleText.slice(0, 1500),
    schemaTypes,
    businessName,
    lang,
  };

  if (capped) parseWarnings.push("The page has an unusually large number of elements, so only the first part of some lists was analysed.");

  return {
    $,
    parseWarnings,
    url,
    facts,
    visibleText,
    fullText,
    viewport,
    canonicalHref,
    metaByName,
    og,
    twitter,
    metaRobots,
    jsonLd: { blocks, invalid, errors, topNodes, allNodes },
    idMap,
    microdataTypes,
    scriptCount,
    emptyRootSelector,
    noscriptNeedsJs,
    links,
    socialLinks: [...socialSet],
    telLinks,
    textPhones,
    hasAddressElement,
    logoCandidate,
    firstImage,
    author,
    publishedTime,
    sections,
    detailsCount,
    hasFaqHeading,
    hasListOrTable,
    isHome,
  };
}

/** Resolve a `{ "@id": "..." }` reference against the page's JSON-LD graph. */
export function resolveRef(page: ParsedPage, v: unknown): unknown {
  if (isNode(v) && typeof v["@id"] === "string" && Object.keys(v).length === 1) {
    return page.idMap.get(v["@id"]) ?? v;
  }
  return v;
}
