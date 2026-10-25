import type { AnalyseInput } from "../index";
import type { LlmsInfo, RobotsInfo, SitemapInfo } from "../context";

const WORDS = "clinic patient visit care smile comfort appointment treatment dentist whitening results friendly gentle modern advice plan price quality enamel sensitive procedure".split(" ");

/** Deterministic filler text of exactly n words. */
export function filler(n: number, seed = 0): string {
  const out: string[] = [];
  for (let i = 0; i < n; i++) out.push(WORDS[(i * 7 + seed) % WORDS.length]);
  out[0] = out[0][0].toUpperCase() + out[0].slice(1);
  return out.join(" ") + ".";
}

export const robotsOpen: RobotsInfo = {
  status: "found",
  httpStatus: 200,
  text: "User-agent: *\nDisallow: /admin/\n\nSitemap: https://www.brightsmile.example/sitemap.xml\n",
  sitemaps: ["https://www.brightsmile.example/sitemap.xml"],
};
export const robotsMissing: RobotsInfo = { status: "missing", httpStatus: 404, text: null, sitemaps: [] };
export const llmsFound: LlmsInfo = { found: true, httpStatus: 200 };
export const llmsMissing: LlmsInfo = { found: false, httpStatus: 404, note: "not found" };
export const sitemapFound: SitemapInfo = { found: true, url: "https://www.brightsmile.example/sitemap.xml", via: "robots.txt" };
export const sitemapMissing: SitemapInfo = { found: false };

// ---------------------------------------------------------------------------
// 1. Strong page: full schema, FAQ, question headings, answer-first sections
// ---------------------------------------------------------------------------

const STRONG_URL = "https://www.brightsmile.example/services/teeth-whitening";

const QUESTIONS = [
  "What is professional teeth whitening?",
  "How long does teeth whitening last?",
  "Is teeth whitening safe for sensitive teeth?",
  "How much does teeth whitening cost?",
  "Who should not whiten their teeth?",
  "How do I book a whitening appointment?",
];

export function strongHtml(extraHead = ""): string {
  const sections = QUESTIONS.map(
    (q, i) => `<h2>${q}</h2>\n<p>${filler(45, i)}</p>\n<p>${filler(75, i + 3)}</p>`,
  ).join("\n");
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Dentist",
        "@id": "https://www.brightsmile.example/#org",
        name: "BrightSmile Dental",
        url: "https://www.brightsmile.example/",
        logo: "https://www.brightsmile.example/logo.png",
        telephone: "+44 113 496 0000",
        address: { "@type": "PostalAddress", streetAddress: "12 King Street", addressLocality: "Leeds", postalCode: "LS1 1AA", addressCountry: "GB" },
        sameAs: ["https://www.facebook.com/brightsmile", "https://www.linkedin.com/company/brightsmile", "https://www.instagram.com/brightsmile"],
      },
      { "@type": "WebSite", name: "BrightSmile Dental", url: "https://www.brightsmile.example/" },
      { "@type": "Service", name: "Teeth whitening", provider: { "@id": "https://www.brightsmile.example/#org" } },
      {
        "@type": "FAQPage",
        mainEntity: [{ "@type": "Question", name: "How long does it take?", acceptedAnswer: { "@type": "Answer", text: "About an hour." } }],
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: "https://www.brightsmile.example/" },
          { "@type": "ListItem", position: 2, name: "Teeth whitening", item: STRONG_URL },
        ],
      },
    ],
  };
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Teeth Whitening in Leeds | BrightSmile Dental</title>
<meta name="description" content="Safe, dentist-led teeth whitening in Leeds. Learn how it works, how long it lasts, what it costs and how to book an appointment.">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="canonical" href="${STRONG_URL}">
<meta property="og:title" content="Teeth Whitening in Leeds | BrightSmile Dental">
<meta property="og:description" content="Safe, dentist-led teeth whitening in Leeds.">
<meta property="og:image" content="https://www.brightsmile.example/og.jpg">
<meta property="og:site_name" content="BrightSmile Dental">
<meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
${extraHead}
</head>
<body>
<header><nav><a href="/">Home</a> <a href="/about">About us</a> <a href="/contact">Contact</a></nav></header>
<main>
<h1>Teeth whitening in Leeds</h1>
<p>${filler(50, 11)}</p>
${sections}
<ul><li>Gentle gel</li><li>Custom trays</li><li>Same-day results</li></ul>
<h2>Frequently asked questions</h2>
<details><summary>Does it hurt?</summary><p>${filler(30, 5)}</p></details>
<details><summary>Can I eat afterwards?</summary><p>${filler(30, 6)}</p></details>
<details><summary>Do you offer payment plans?</summary><p>${filler(30, 8)}</p></details>
</main>
<footer><address>12 King Street, Leeds LS1 1AA</address><a href="tel:+441134960000">0113 496 0000</a></footer>
</body>
</html>`;
}

export function strongInput(overrides: Partial<AnalyseInput> = {}): AnalyseInput {
  return {
    html: strongHtml(),
    finalUrl: STRONG_URL,
    statusCode: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
    robots: robotsOpen,
    llms: llmsFound,
    sitemap: sitemapFound,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 2. Weak page: no schema, two H1s, no meta description, thin content
// ---------------------------------------------------------------------------

export const WEAK_URL = "https://weak.example/page";

export const weakHtml = `<!doctype html>
<html>
<head><title>Home</title></head>
<body>
<h1>Welcome</h1>
<h1>Our company</h1>
<h3>Things</h3>
<div>${filler(110, 2)}</div>
</body>
</html>`;

export function weakInput(): AnalyseInput {
  return {
    html: weakHtml,
    finalUrl: WEAK_URL,
    statusCode: 200,
    headers: {},
    robots: robotsMissing,
    llms: llmsMissing,
    sitemap: sitemapMissing,
  };
}

// ---------------------------------------------------------------------------
// 3. JS shell: rich <head>, empty #root, lots of scripts
// ---------------------------------------------------------------------------

export const SHELL_URL = "https://spa.example/";

export const shellHtml = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>SPA Studio | Project management for small teams</title>
<meta name="description" content="SPA Studio is project management software for small teams that want fewer meetings and clearer plans.">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="canonical" href="${SHELL_URL}">
<meta property="og:title" content="SPA Studio">
<meta property="og:description" content="Project management for small teams.">
<meta property="og:image" content="https://spa.example/og.png">
<meta property="og:site_name" content="SPA Studio">
<meta name="twitter:card" content="summary">
<script type="application/ld+json">${JSON.stringify({
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "Organization", name: "SPA Studio", url: "https://spa.example/", logo: "https://spa.example/logo.png", sameAs: ["https://www.linkedin.com/company/spa-studio", "https://github.com/spa-studio"] },
    { "@type": "WebSite", name: "SPA Studio", url: "https://spa.example/" },
  ],
})}</script>
</head>
<body>
<div id="root"></div>
<noscript>You need to enable JavaScript to run this app.</noscript>
${Array.from({ length: 7 }, (_, i) => `<script src="/static/chunk-${i}.js"></script>`).join("\n")}
</body>
</html>`;

export function shellInput(): AnalyseInput {
  return {
    html: shellHtml,
    finalUrl: SHELL_URL,
    statusCode: 200,
    headers: {},
    robots: { status: "found", httpStatus: 200, text: "User-agent: *\nAllow: /\n", sitemaps: [] },
    llms: llmsFound,
    sitemap: { found: true, url: "https://spa.example/sitemap.xml", via: "/sitemap.xml" },
  };
}
