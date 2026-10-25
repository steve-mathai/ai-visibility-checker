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

export interface ParsedPage {
  $: CheerioAPI;
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

function extractText($: CheerioAPI, removeSelector: string): string {
  const body = $("body").clone();
  body.find(removeSelector).remove();
  body.find(BLOCK_SELECTOR).after(" ");
  return clean(body.text());
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
  const REMOVE_ALWAYS = "script,style,noscript,svg,template,[hidden]";
  const visibleText = extractText($, `${REMOVE_ALWAYS},nav,footer,header`);
  const fullText = extractText($, REMOVE_ALWAYS);
  const wordCount = countWords(visibleText);

  // ---- headings ----
  const headings: { level: number; text: string }[] = [];
  $("h1,h2,h3,h4,h5,h6").each((_, el) => {
    const text = clean($(el).text());
    if (!text) return;
    const level = Number((el as { tagName: string }).tagName.slice(1));
    headings.push({ level, text });
  });
  const h1 = headings.filter((h) => h.level === 1).map((h) => h.text);

  // ---- sections (answer-first analysis) ----
  const sections: Section[] = [];
  $("h2,h3").each((_, el) => {
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
  const microdataTypes: string[] = [];
  $("[itemscope][itemtype]").each((_, el) => {
    const t = shortType($(el).attr("itemtype") ?? "");
    if (t && !microdataTypes.includes(t)) microdataTypes.push(t);
  });

  const schemaTypes: string[] = [];
  for (const n of topNodes) for (const t of typesOf(n)) if (!schemaTypes.includes(t)) schemaTypes.push(t);
  for (const t of microdataTypes) if (!schemaTypes.includes(t)) schemaTypes.push(t);

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
    const href = ($(el).attr("href") ?? "").trim();
    if (!href || href.startsWith("#") || /^javascript:/i.test(href)) return;
    if (/^tel:/i.test(href)) {
      telLinks.push(decodeURIComponent(href.slice(4)));
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
  const textPhones: string[] = [];
  for (const m of fullText.matchAll(PHONE_RE)) {
    const d = digitsOnly(m[0]);
    if (d.length >= 10 && d.length <= 13 && !textPhones.includes(m[0].trim())) textPhones.push(m[0].trim());
  }
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

  return {
    $,
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
