import type { CheckResult } from "../types";
import type { AuditContext } from "../context";
import { digitsOnly, titleSegments } from "../parse";
import { asStringArray, isLocalType, isNode, typesOf } from "../schema";
import { brandName, check, findOrgNode, findSiteLinks, fix, hasType, normaliseName, nodeString, truncate } from "./util";

const CAT = "entity" as const;

// ---------------------------------------------------------------------------
// Business name
// ---------------------------------------------------------------------------

function agree(a: string, b: string): boolean {
  const x = normaliseName(a);
  const y = normaliseName(b);
  if (x.length < 3 || y.length < 3) return false;
  return x === y || x.includes(y) || y.includes(x);
}

function businessName(ctx: AuditContext): CheckResult {
  const max = 3;
  const p = ctx.page;
  const org = findOrgNode(ctx);
  const schemaName = org ? nodeString(ctx, org, "name") : null;
  const ogName = p.og["og:site_name"] ?? null;
  const segments = titleSegments(p.facts.title);

  const evidence = [
    `Organization schema name: ${schemaName ?? "not found"}`,
    `og:site_name: ${ogName ?? "not found"}`,
    `Page title: ${p.facts.title ?? "not found"}`,
  ];

  const pairs: [string, string][] = [];
  if (schemaName && ogName && agree(schemaName, ogName)) pairs.push(["schema", "og:site_name"]);
  if (schemaName && segments.some((s) => agree(s, schemaName))) pairs.push(["schema", "title"]);
  if (ogName && segments.some((s) => agree(s, ogName))) pairs.push(["og:site_name", "title"]);

  const sourceCount = [schemaName, ogName, p.facts.title].filter(Boolean).length;
  const canonical = schemaName ?? ogName ?? brandName(ctx);
  const snippet = [
    `<meta property="og:site_name" content="${canonical}">`,
    `<title>Page topic | ${canonical}</title>`,
    `"name": "${canonical}"  <!-- inside your Organization JSON-LD -->`,
  ].join("\n");

  if (pairs.length) {
    const used = [...new Set(pairs.flat())].join(", ");
    return check(CAT, "business-name", "Business name is stated consistently", max, "pass", max, `The business name "${truncate(canonical, 50)}" is consistent across ${used}.`, { evidence });
  }
  if (sourceCount === 0) {
    return check(CAT, "business-name", "Business name is stated consistently", max, "fail", 0, "No business name was found in the structured data, the Open Graph tags or the page title.", {
      evidence,
      fix: fix(
        "State your business name in the title, Open Graph tags and schema",
        "Engines build their picture of a brand from repeated, matching signals. If the name is missing or inconsistent they may cite you under the wrong name or not connect the page to your business.",
        "Use the exact same business name in the page title, the og:site_name tag and the name field of your Organization structured data. Replace the example name below if it is not right.",
        "high",
        "quick",
        snippet,
      ),
    });
  }
  const mismatch = sourceCount >= 2;
  return check(CAT, "business-name", "Business name is stated consistently", max, "warn", 1, mismatch ? "The business name differs between the structured data, the Open Graph tags and the page title." : "The business name appears in only one place, so there is nothing to confirm it against.", {
    evidence,
    fix: fix(
      mismatch ? "Use one consistent business name everywhere" : "Repeat your business name in the title, Open Graph tags and schema",
      "Engines build their picture of a brand from repeated, matching signals. Differences in spelling or form (for example \"Acme Ltd\" and \"ACME Plumbing\") can make them treat the signals as different businesses.",
      `Pick the exact name customers know you by and use it in the page title, the og:site_name tag and the name field of your Organization structured data. We suggest "${canonical}" based on what we found.`,
      "medium",
      "quick",
      snippet,
    ),
  });
}

// ---------------------------------------------------------------------------
// Contact details
// ---------------------------------------------------------------------------

const last10 = (s: string) => digitsOnly(s).slice(-10);

function schemaValues(ctx: AuditContext, key: string): unknown[] {
  return ctx.page.jsonLd.allNodes.flatMap((n) => (n[key] === undefined ? [] : [n[key]]));
}

function contact(ctx: AuditContext): CheckResult {
  const max = 3;
  const p = ctx.page;
  const schemaPhones = schemaValues(ctx, "telephone").flatMap((v) => asStringArray(v)).filter((s) => digitsOnly(s).length >= 7);
  const pagePhones = [...p.telLinks, ...p.textPhones].filter((s) => digitsOnly(s).length >= 7);
  const hasPhone = schemaPhones.length > 0 || pagePhones.length > 0;
  const hasSchemaAddress = schemaValues(ctx, "address").some((v) => (isNode(v) ? Object.keys(v).length > 1 : typeof v === "string" && v.trim().length > 5));
  const hasAddress = hasSchemaAddress || p.hasAddressElement;

  const schemaSet = new Set(schemaPhones.map(last10));
  const pageSet = new Set(pagePhones.map(last10));
  const overlap = [...schemaSet].some((x) => pageSet.has(x));
  const conflict = schemaSet.size > 0 && pageSet.size > 0 && !overlap;

  const org = findOrgNode(ctx);
  // Only a LocalBusiness-type entity counts as local: SaaS and media sites publish an HQ address too.
  const isLocal = (org ? typesOf(org).some(isLocalType) : false) || p.microdataTypes.some(isLocalType);

  const evidence = [
    `Phone in structured data: ${schemaPhones[0] ?? "none"}`,
    `Phone on page: ${pagePhones[0] ?? "none"}`,
    `Address: ${hasSchemaAddress ? "in structured data" : p.hasAddressElement ? "in an <address> element" : "none found"}`,
  ];

  const points = (hasPhone ? 1 : 0) + (hasAddress ? 1 : 0) + (!conflict && (hasPhone || hasAddress) ? 1 : 0);
  if (hasPhone && hasAddress && !conflict) {
    return check(CAT, "contact-details", "Phone and address are published", max, "pass", max, "A phone number and address are both published and consistent.", { evidence });
  }

  const telForSnippet = pagePhones[0] ?? schemaPhones[0];
  const fragments: string[] = [];
  if (!hasPhone || conflict) fragments.push(`"telephone": "${telForSnippet ?? "+REPLACE_WITH_PHONE_NUMBER"}"`);
  if (!hasSchemaAddress) {
    fragments.push(
      '"address": {\n  "@type": "PostalAddress",\n  "streetAddress": "REPLACE_WITH_STREET_ADDRESS",\n  "addressLocality": "REPLACE_WITH_CITY",\n  "postalCode": "REPLACE_WITH_POSTCODE",\n  "addressCountry": "REPLACE_WITH_COUNTRY_CODE"\n}',
    );
  }
  const snippet = fragments.length ? fragments.join(",\n") : undefined;

  if (conflict) {
    return check(CAT, "contact-details", "Phone and address are published", max, "warn", points, `The phone number in the structured data (${schemaPhones[0]}) does not match the one on the page (${pagePhones[0]}).`, {
      evidence,
      fix: fix(
        "Make the phone number match everywhere",
        "When the number in your markup differs from the one on the page, engines cannot be sure which is right and may show neither.",
        "Decide which number is correct and update the other so they match, including the structured data, the page, the footer and any Google Business Profile.",
        "medium",
        "quick",
        snippet,
      ),
    });
  }

  const missing = [!hasPhone && "a phone number", !hasAddress && "a postal address"].filter(Boolean).join(" or ");
  if (isLocal) {
    const none = !hasPhone && !hasAddress;
    return check(CAT, "contact-details", "Phone and address are published", max, none ? "fail" : "warn", points, `This looks like a local business but the page does not show ${missing}.`, {
      evidence,
      fix: fix(
        "Publish your phone number and address on the page and in schema",
        "For local questions such as \"plumber near me\", engines rely on a consistent name, address and phone number. Missing details make it harder to trust and cite you.",
        "Show your phone number and full address in the footer or on a contact section as plain text (not an image), wrap the address in an <address> tag, and add the same details to your Organization or LocalBusiness structured data.",
        "high",
        "quick",
        snippet,
      ),
    });
  }
  return check(CAT, "contact-details", "Phone and address are published", max, "warn", points, `The page does not show ${missing}. That is common for online businesses, but a contact route helps engines and visitors trust the source.`, {
    evidence,
    fix: fix(
      "Publish a phone number or address if you have one",
      "Visible contact details are a basic trust signal. A postal address is optional for online-only businesses.",
      "If you have a phone line or office, show it in the footer as plain text and add it to your Organization structured data. If you are fully online, make sure a contact page or form is linked from every page.",
      "low",
      "quick",
      snippet,
    ),
  });
}

// ---------------------------------------------------------------------------
// About and Contact pages
// ---------------------------------------------------------------------------

function aboutContact(ctx: AuditContext): CheckResult {
  const max = 3;
  const links = findSiteLinks(ctx);
  const evidence = [`About: ${links.about?.url ?? "no link found"}`, `Contact: ${links.contact?.url ?? "no link found"}`];
  const points = (links.about ? 1 : 0) + (links.contact ? 1 : 0) + (links.about && links.contact ? 1 : 0);
  if (links.about && links.contact) {
    return check(CAT, "about-contact", "About and Contact pages are linked", max, "pass", max, "The page links to both an About page and a Contact page.", { evidence });
  }
  const missing = [!links.about && "an About page", !links.contact && "a Contact page"].filter(Boolean).join(" or ");
  const origin = ctx.page.url.origin;
  const rows = [
    !links.about && `<a href="${origin}/about">About us</a>`,
    !links.contact && `<a href="${origin}/contact">Contact</a>`,
  ].filter(Boolean) as string[];
  return check(CAT, "about-contact", "About and Contact pages are linked", max, "warn", points, `No link to ${missing} was found on this page.`, {
    evidence,
    fix: fix(
      `Link to ${missing} from the main menu or footer`,
      "These pages tell engines (and people) who stands behind the site and how to reach them. They are among the first things checked when judging whether a source is trustworthy.",
      "Create the page if it does not exist: say who you are, how long you have operated, who works there and how to get in touch. Then link to it from the header menu or footer on every page, using plain wording such as \"About\" and \"Contact\".",
      "medium",
      "moderate",
      rows.join("\n"),
    ),
  });
}

// ---------------------------------------------------------------------------
// Authorship
// ---------------------------------------------------------------------------

function authorship(ctx: AuditContext): CheckResult {
  const p = ctx.page;
  const articleLike = hasType(ctx, "Article", "BlogPosting", "NewsArticle", "TechArticle", "ScholarlyArticle") || (p.og["og:type"] ?? "").toLowerCase() === "article";
  if (!articleLike) {
    return check(CAT, "authorship", "Author is named on articles", 0, "info", 0, p.author ? `An author is named (${truncate(p.author, 40)}).` : "This does not look like an article, so an author byline is not expected.");
  }
  if (p.author) {
    return check(CAT, "authorship", "Author is named on articles", 1, "pass", 1, `The article names its author (${truncate(p.author, 40)}).`, { evidence: [`Author: ${p.author}`] });
  }
  return check(CAT, "authorship", "Author is named on articles", 1, "warn", 0, "This looks like an article but no author byline was found.", {
    fix: fix(
      "Add an author byline with a short bio",
      "Named, credentialed authors are a trust signal. Engines and readers weigh content more heavily when they can see a real person with relevant experience stands behind it.",
      "Show \"By Name\" near the top of the article, link it to an author page with a short bio, and add the same person to the article's structured data.",
      "low",
      "quick",
      '"author": {\n  "@type": "Person",\n  "name": "REPLACE_WITH_AUTHOR_NAME",\n  "url": "REPLACE_WITH_AUTHOR_PAGE_URL"\n}',
    ),
  });
}

export function entityChecks(ctx: AuditContext): CheckResult[] {
  return [businessName(ctx), contact(ctx), aboutContact(ctx), authorship(ctx)];
}
