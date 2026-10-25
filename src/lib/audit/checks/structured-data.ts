import type { CheckResult } from "../types";
import type { AuditContext } from "../context";
import { asStringArray, isOrgType, typesOf } from "../schema";
import {
  brandName,
  check,
  findEntityNodes,
  findOrgNode,
  fix,
  hasType,
  jsonLdSnippet,
  nodeLogo,
  nodeString,
  nodeValue,
  plural,
  questionSections,
  truncate,
} from "./util";

const CAT = "structured-data" as const;

const ARTICLE_TYPES = ["Article", "BlogPosting", "NewsArticle", "TechArticle", "ScholarlyArticle", "Report", "LiveBlogPosting"];
const SPECIFIC_TYPES = [
  ...ARTICLE_TYPES, "Product", "FAQPage", "HowTo", "Service", "Event", "Recipe", "SoftwareApplication",
  "MobileApplication", "WebApplication", "Course", "VideoObject", "QAPage", "ProfilePage", "CollectionPage",
  "AboutPage", "ContactPage", "ItemPage", "MedicalWebPage", "RealEstateListing", "JobPosting", "Book", "Movie",
  "Review", "CheckoutPage", "SearchResultsPage",
];

// ---------------------------------------------------------------------------
// Snippet builders (use only what was detected on the page)
// ---------------------------------------------------------------------------

function orgData(ctx: AuditContext, onlyMissing?: { name: boolean; url: boolean; logo: boolean }) {
  const p = ctx.page;
  const origin = p.url.origin;
  const full: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: brandName(ctx),
    url: origin + "/",
    logo: p.logoCandidate ?? `${origin}/logo.png`,
  };
  const tel = p.telLinks[0];
  if (tel) full.telephone = tel;
  if (p.socialLinks.length) full.sameAs = p.socialLinks.slice(0, 6);
  if (!onlyMissing) return full;
  const out: Record<string, unknown> = {};
  if (onlyMissing.name) out.name = full.name;
  if (onlyMissing.url) out.url = full.url;
  if (onlyMissing.logo) out.logo = full.logo;
  return out;
}

function fragment(obj: Record<string, unknown>): string {
  const lines = JSON.stringify(obj, null, 2).split("\n");
  return lines.slice(1, -1).map((l) => l.trim()).join("\n");
}

function websiteData(ctx: AuditContext) {
  return { "@type": "WebSite", name: brandName(ctx), url: ctx.page.url.origin + "/" };
}

function breadcrumbData(ctx: AuditContext) {
  const f = ctx.page.facts;
  const items: unknown[] = [{ "@type": "ListItem", position: 1, name: "Home", item: ctx.page.url.origin + "/" }];
  if (!ctx.page.isHome) {
    items.push({ "@type": "ListItem", position: 2, name: f.h1[0] ?? f.title ?? "This page", item: f.finalUrl });
  }
  return { "@type": "BreadcrumbList", itemListElement: items };
}

type PageKind = "Article" | "Product" | "FAQPage" | "Service" | "WebPage";

function guessPageKind(ctx: AuditContext): PageKind {
  const p = ctx.page;
  const ogType = (p.og["og:type"] ?? "").toLowerCase();
  const path = p.url.pathname.toLowerCase();
  if (ogType === "article" || /\/(blog|news|article|articles|post|posts|insights|stories|guides?)\//.test(path)) return "Article";
  if (ogType.includes("product") || /\/(products?|shop|store|item)\//.test(path)) return "Product";
  if (questionSections(ctx).length >= 2) return "FAQPage";
  if (/\/services?\b/.test(path)) return "Service";
  if (p.$("article time[datetime], article [rel~='author']").length) return "Article";
  return "WebPage";
}

function faqData(ctx: AuditContext) {
  const pairs = questionSections(ctx)
    .filter((s) => s.firstParagraph)
    .slice(0, 5)
    .map((s) => ({
      "@type": "Question",
      name: s.heading,
      acceptedAnswer: { "@type": "Answer", text: truncate(s.firstParagraph as string, 400) },
    }));
  return pairs.length ? { "@type": "FAQPage", mainEntity: pairs } : null;
}

function pageTypeSnippet(ctx: AuditContext, kind: PageKind): string | undefined {
  const p = ctx.page;
  const f = p.facts;
  const image = p.og["og:image"] ?? p.firstImage ?? undefined;
  const description = f.metaDescription ?? p.og["og:description"] ?? undefined;
  const name = f.h1[0] ?? f.title ?? brandName(ctx);
  const ctxKey = { "@context": "https://schema.org" };
  switch (kind) {
    case "Article": {
      const data: Record<string, unknown> = { ...ctxKey, "@type": "Article", headline: truncate(name, 110), mainEntityOfPage: f.finalUrl };
      if (description) data.description = description;
      if (image) data.image = image;
      if (p.publishedTime) data.datePublished = p.publishedTime;
      data.author = { "@type": "Person", name: p.author ?? "REPLACE_WITH_AUTHOR_NAME" };
      data.publisher = { "@type": "Organization", name: brandName(ctx), logo: { "@type": "ImageObject", url: p.logoCandidate ?? `${p.url.origin}/logo.png` } };
      return jsonLdSnippet(data);
    }
    case "Product": {
      const data: Record<string, unknown> = { ...ctxKey, "@type": "Product", name };
      if (description) data.description = description;
      if (image) data.image = image;
      data.brand = { "@type": "Brand", name: brandName(ctx) };
      return jsonLdSnippet(data);
    }
    case "FAQPage": {
      const faq = faqData(ctx);
      return faq ? jsonLdSnippet({ ...ctxKey, ...faq }) : undefined;
    }
    case "Service": {
      const data: Record<string, unknown> = { ...ctxKey, "@type": "Service", name, provider: { "@type": "Organization", name: brandName(ctx), url: p.url.origin + "/" } };
      if (description) data.description = description;
      return jsonLdSnippet(data);
    }
    default: {
      const data: Record<string, unknown> = { ...ctxKey, "@type": "WebPage", name: f.title ?? name, url: f.finalUrl, isPartOf: { "@type": "WebSite", name: brandName(ctx), url: p.url.origin + "/" } };
      if (description) data.description = description;
      return jsonLdSnippet(data);
    }
  }
}

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------

function jsonLdPresent(ctx: AuditContext): CheckResult {
  const max = 6;
  const { blocks, invalid, errors } = ctx.page.jsonLd;
  const micro = ctx.page.microdataTypes;
  const valid = blocks - invalid;
  const evidence = [`${plural(blocks, "JSON-LD block")} found, ${invalid} could not be parsed`, ...errors];
  if (micro.length) evidence.push(`Microdata types: ${micro.join(", ")}`);

  if (blocks > 0 && invalid === 0) {
    return check(CAT, "jsonld-valid", "Structured data (JSON-LD) is present and valid", max, "pass", max, `${plural(blocks, "JSON-LD block")} found and every one parses correctly.`, { evidence: [...evidence, `Types: ${ctx.page.facts.schemaTypes.join(", ") || "none"}`] });
  }
  if (blocks > 0 && valid > 0) {
    return check(CAT, "jsonld-valid", "Structured data (JSON-LD) is present and valid", max, "warn", 4, `${invalid} of ${plural(blocks, "JSON-LD block")} contain errors and will be ignored by search engines.`, {
      evidence,
      fix: fix(
        "Repair the broken JSON-LD blocks",
        "A block with a syntax error is skipped entirely, so the details inside it never reach search or AI engines.",
        `Paste each block into validator.schema.org or Google's Rich Results Test and fix the first error it reports. The usual causes are a trailing comma, a missing quote or a curly quote pasted from a document. First error found: ${errors[0] ?? "unknown"}.`,
        "medium",
        "quick",
      ),
    });
  }
  if (blocks > 0) {
    return check(CAT, "jsonld-valid", "Structured data (JSON-LD) is present and valid", max, "fail", micro.length ? 2 : 0, `All ${plural(blocks, "JSON-LD block")} on the page contain errors, so none of it can be read.`, {
      evidence,
      fix: fix(
        "Repair the broken JSON-LD blocks",
        "A block with a syntax error is skipped entirely, so the details inside it never reach search or AI engines.",
        `Paste each block into validator.schema.org or Google's Rich Results Test and fix the first error it reports. The usual causes are a trailing comma, a missing quote or a curly quote pasted from a document. First error found: ${errors[0] ?? "unknown"}.`,
        "high",
        "quick",
      ),
    });
  }
  const starter = jsonLdSnippet({
    "@context": "https://schema.org",
    "@graph": [
      { ...websiteData(ctx), "@id": `${ctx.page.url.origin}/#website` },
      {
        "@type": "WebPage",
        "@id": `${ctx.page.facts.finalUrl}#webpage`,
        url: ctx.page.facts.finalUrl,
        name: ctx.page.facts.title ?? brandName(ctx),
        ...(ctx.page.facts.metaDescription ? { description: ctx.page.facts.metaDescription } : {}),
        isPartOf: { "@id": `${ctx.page.url.origin}/#website` },
      },
    ],
  });
  if (micro.length) {
    return check(CAT, "jsonld-valid", "Structured data (JSON-LD) is present and valid", max, "warn", 3, `Only older microdata markup was found (${micro.slice(0, 4).join(", ")}). It works, but JSON-LD is easier for engines to read and for you to maintain.`, {
      evidence,
      fix: fix(
        "Add JSON-LD structured data",
        "JSON-LD is the format Google recommends. It sits in one block, separate from your layout, so it is less likely to break when the design changes.",
        "Add a JSON-LD block to the page head. The starter below describes the site and this page; the other structured data fixes on this report add the details.",
        "medium",
        "moderate",
        starter,
      ),
    });
  }
  return check(CAT, "jsonld-valid", "Structured data (JSON-LD) is present and valid", max, "fail", 0, "No structured data was found on the page.", {
    evidence,
    fix: fix(
      "Add JSON-LD structured data",
      "Structured data states plainly who you are and what the page is about. Search and AI engines use it to identify the business and the content without having to guess from the layout.",
      "Paste this block into the page head (most site builders and SEO plugins have a custom code or schema field). The other fixes on this report add the organisation and page-type details to it.",
      "high",
      "moderate",
      starter,
    ),
  });
}

function organisation(ctx: AuditContext): CheckResult {
  const max = 6;
  const org = findOrgNode(ctx);
  if (!org) {
    const microOrg = ctx.page.microdataTypes.find(isOrgType);
    const snippet = jsonLdSnippet(orgData(ctx));
    const f = fix(
      "Add Organization (or LocalBusiness) structured data",
      "This is how engines learn that your name, website and logo belong to one real business. Without it they have to infer the brand from page text, which is less reliable.",
      "Add the block below to your home page, and ideally every page. Check the logo address points at your real logo file. If you serve customers at a physical location, change \"Organization\" to \"LocalBusiness\" (or a closer type such as Restaurant or Dentist) and add address and phone details. If this is a personal site, use \"Person\" instead.",
      "high",
      "quick",
      snippet,
    );
    if (microOrg) {
      return check(CAT, "schema-organization", "Organization or business markup", max, "warn", 2, `A ${microOrg} appears in microdata only; JSON-LD markup for the organisation is missing.`, { evidence: [`Microdata type: ${microOrg}`], fix: f });
    }
    return check(CAT, "schema-organization", "Organization or business markup", max, "fail", 0, "No Organization or LocalBusiness structured data was found.", { evidence: [`Schema types on page: ${ctx.page.facts.schemaTypes.join(", ") || "none"}`], fix: f });
  }
  const name = nodeString(ctx, org, "name");
  const url = nodeString(ctx, org, "url");
  const logo = nodeLogo(ctx, org);
  const missing = { name: !name, url: !url, logo: !logo };
  const evidence = [`Type: ${typesOf(org).join(", ")}`, `name: ${name ?? "missing"}`, `url: ${url ?? "missing"}`, `logo: ${logo ?? "missing"}`];
  const earned = (name ? 2 : 0) + (url ? 2 : 0) + (logo ? 2 : 0);
  if (earned === max) {
    return check(CAT, "schema-organization", "Organization or business markup", max, "pass", max, `${typesOf(org)[0]} markup is present with name, URL and logo.`, { evidence });
  }
  const missingNames = [missing.name && "name", missing.url && "url", missing.logo && "logo"].filter(Boolean) as string[];
  return check(CAT, "schema-organization", "Organization or business markup", max, "warn", earned, `${typesOf(org)[0]} markup exists but is missing ${missingNames.join(", ")}.`, {
    evidence,
    fix: fix(
      `Add ${missingNames.join(" and ")} to your Organization markup`,
      "Name, URL and logo are the basics engines use to recognise the brand and show it consistently.",
      `Add the missing ${missingNames.length === 1 ? "property" : "properties"} to the existing ${typesOf(org)[0]} block.${missing.logo ? " Use the address of a square or wide logo image, at least 112 pixels across." : ""}`,
      "medium",
      "quick",
      fragment(orgData(ctx, missing)),
    ),
  });
}

function sameAs(ctx: AuditContext): CheckResult {
  const max = 3;
  const entities = findEntityNodes(ctx);
  const links = new Set<string>();
  for (const e of entities) {
    for (const v of asStringArray(nodeValue(ctx, e, "sameAs"))) if (/^https?:\/\//i.test(v)) links.add(v);
  }
  const evidence = [...links];
  if (links.size >= 2) {
    return check(CAT, "schema-sameas", "sameAs profile links", max, "pass", max, `The organisation is linked to ${plural(links.size, "outside profile")}, which helps engines connect the brand across the web.`, { evidence });
  }
  const found = ctx.page.socialLinks;
  const snippet = found.length
    ? fragment({ sameAs: found.slice(0, 6) })
    : fragment({ sameAs: ["https://www.linkedin.com/company/REPLACE_WITH_YOUR_PAGE", "https://www.facebook.com/REPLACE_WITH_YOUR_PAGE"] });
  const how = found.length
    ? "Add this property inside your Organization markup. The addresses come from social links already on your page; remove any that are not official profiles."
    : "Add this property inside your Organization markup, replacing the placeholders with your real profile addresses. Include any that exist: LinkedIn, Facebook, X, YouTube, Instagram, Crunchbase, Wikipedia or Wikidata.";
  return check(CAT, "schema-sameas", "sameAs profile links", max, "warn", links.size === 1 ? 1 : 0, links.size === 1 ? "Only one sameAs profile link is declared." : "No sameAs profile links were found in the structured data.", {
    evidence: evidence.length ? evidence : [entities.length ? "Entity found, but without sameAs" : "No Organization or Person entity found"],
    fix: fix(
      "Add sameAs links to your official profiles",
      "sameAs tells engines that your site, your LinkedIn page and your Wikipedia or Crunchbase entry are the same business. That helps them trust and consistently name you when they cite you.",
      how,
      "medium",
      "quick",
      snippet,
    ),
  });
}

function pageType(ctx: AuditContext): CheckResult {
  const max = 5;
  const p = ctx.page;
  const specific = p.facts.schemaTypes.filter((t) => SPECIFIC_TYPES.some((s) => s.toLowerCase() === t.toLowerCase()));
  const orgOnHome = p.isHome && p.facts.schemaTypes.some(isOrgType);
  const questions = questionSections(ctx).length;
  const hasFaq = hasType(ctx, "FAQPage");
  const evidence = [`Schema types on page: ${p.facts.schemaTypes.join(", ") || "none"}`];

  if (specific.length || orgOnHome) {
    if (questions >= 2 && !hasFaq) evidence.push(`${plural(questions, "question-style heading")} found; FAQPage markup could be added as well.`);
    const label = specific.length ? specific.slice(0, 3).join(", ") : "Organization (home page)";
    return check(CAT, "schema-page-type", "Page-type structured data", max, "pass", max, `The page declares a content type (${label}).`, { evidence });
  }

  const kind = guessPageKind(ctx);
  const faqNote = questions >= 2 && !hasFaq;
  const snippet = pageTypeSnippet(ctx, kind);
  const typeName = kind === "WebPage" ? "WebPage" : kind;
  const generic = p.facts.schemaTypes.some((t) => t.toLowerCase() === "webpage");
  const why = faqNote
    ? "The page has question-style headings but no FAQPage markup. FAQPage states each question and answer in a machine-readable way, which makes them easy for answer engines to lift. Google now shows FAQ rich results for only a few sites, so the benefit is clarity for machines rather than a visual snippet."
    : "Page-type markup says whether this is an article, a product, a service or a set of answers. Engines use that to decide how to treat and quote the page.";
  const how = kind === "Article"
    ? "Add the block below. Check the headline, dates and author, and replace REPLACE_WITH_AUTHOR_NAME with the real byline if it was not detected. Dates should use the ISO format 2026-01-31."
    : kind === "Product"
      ? "Add the block below, then add an \"offers\" property with the price, currency and availability so the product details are complete."
      : kind === "FAQPage"
        ? "Add the block below. The questions and answers were taken from the headings and opening paragraphs on the page; the text in the markup must match what visitors see."
        : kind === "Service"
          ? "Add the block below and describe the service area and offer in the description."
          : "Add the block below, or a more specific type if one fits better, such as Article, Product, Service or FAQPage.";
  return check(CAT, "schema-page-type", "Page-type structured data", max, "warn", generic ? 2 : 0, generic ? "Only the generic WebPage type is declared; a more specific type would describe the content better." : `No page-type markup (Article, Product, FAQPage, Service...) was found${faqNote ? ", although the page has question-style headings" : ""}.`, {
    evidence,
    fix: fix(`Add ${typeName} structured data to this page`, why, how, "medium", "moderate", snippet),
  });
}

function websiteBreadcrumb(ctx: AuditContext): CheckResult {
  const max = 2;
  const p = ctx.page;
  const hasWebsite = hasType(ctx, "WebSite");
  const hasCrumbs = hasType(ctx, "BreadcrumbList");
  const crumbsNotNeeded = p.isHome;
  const evidence = [`WebSite: ${hasWebsite ? "yes" : "no"}`, `BreadcrumbList: ${hasCrumbs ? "yes" : crumbsNotNeeded ? "not needed on a home page" : "no"}`];
  const points = (hasWebsite ? 1 : 0) + (hasCrumbs || crumbsNotNeeded ? 1 : 0);
  if (points === max) {
    return check(CAT, "schema-website-breadcrumb", "WebSite and breadcrumb markup", max, "pass", max, hasCrumbs ? "WebSite and BreadcrumbList markup are both present." : "WebSite markup is present (breadcrumbs are not expected on a home page).", { evidence });
  }
  const graph: unknown[] = [];
  if (!hasWebsite) graph.push(websiteData(ctx));
  if (!hasCrumbs && !crumbsNotNeeded) graph.push(breadcrumbData(ctx));
  const missing = [!hasWebsite && "WebSite", !hasCrumbs && !crumbsNotNeeded && "BreadcrumbList"].filter(Boolean).join(" and ");
  return check(CAT, "schema-website-breadcrumb", "WebSite and breadcrumb markup", max, "warn", points, `${missing} markup is missing.`, {
    evidence,
    fix: fix(
      `Add ${missing} markup`,
      "WebSite markup confirms the site name and address. BreadcrumbList shows where a page sits in the site, which helps engines understand how topics are grouped.",
      "A nice-to-have: add the block below next to your other JSON-LD. Check the breadcrumb names match the trail visitors see on the page.",
      "low",
      "quick",
      jsonLdSnippet({ "@context": "https://schema.org", "@graph": graph }),
    ),
  });
}

export function structuredDataChecks(ctx: AuditContext): CheckResult[] {
  return [jsonLdPresent(ctx), organisation(ctx), sameAs(ctx), pageType(ctx), websiteBreadcrumb(ctx)];
}
