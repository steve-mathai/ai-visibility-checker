// Builds the sample report shown at /report?demo=1 by running the real engine on a
// fictional page, so the sample always matches what a live audit produces.
// Run after changing any check:  npx tsx scripts/generate-sample.ts

import { writeFileSync } from "node:fs";
import { analyse } from "../src/lib/audit/index";

const ORIGIN = "https://www.brightsidedental.example";
const PAGE_URL = `${ORIGIN}/`;

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "WebSite", name: "Brightside Dental", url: PAGE_URL },
    {
      "@type": "Dentist",
      name: "Brightside Dental",
      url: PAGE_URL,
      telephone: "+1-512-555-0142",
      address: {
        "@type": "PostalAddress",
        streetAddress: "2104 South Lamar Blvd",
        addressLocality: "Austin",
        addressRegion: "TX",
        postalCode: "78704",
        addressCountry: "US",
      },
    },
  ],
};

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Brightside Dental | Family Dentist in Austin, TX</title>
<meta name="description" content="Welcome to Brightside Dental, Austin's friendliest family dental practice. We offer a full range of general, cosmetic and emergency dental services for the whole family, and we would love to meet you.">
<meta property="og:title" content="Brightside Dental">
<meta property="og:site_name" content="Brightside Dental">
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
</head>
<body>
<header><nav><a href="/">Home</a> <a href="/services">Services</a> <a href="/about">About us</a> <a href="/contact">Contact</a></nav></header>
<main>
<h1>Gentle family dentistry in South Austin</h1>
<p>Welcome to Brightside Dental, where your smile is our passion. Our friendly team has served South Austin families for over a decade, and we believe a visit to the dentist should feel relaxed, welcoming and even a little bit fun. Whether you are new to the area or looking for a fresh start, we would love to get to know you and your family and help everyone keep a healthy, confident smile for years to come.</p>
<h2>Our services</h2>
<p>We look after patients of every age, from a child's first check-up to crowns and implants for adults. Most treatment happens in our South Lamar office, and we keep same-week slots open for new patients and urgent problems. Here is what we offer.</p>
<ul><li>Cleanings and check-ups</li><li>Fillings and crowns</li><li>Invisalign clear aligners</li><li>Teeth whitening</li><li>Emergency appointments</li></ul>
<h4>Cleanings</h4>
<p>A routine cleaning takes about forty-five minutes and includes an exam, polishing and, once a year, a set of digital X-rays. We send a reminder text two days before each visit.</p>
<h2>Pricing</h2>
<p>We accept most major PPO insurance plans, including Delta Dental, Cigna, Aetna and MetLife, and we file claims for you. If you do not have insurance, our in-house membership plan covers two cleanings, two exams and X-rays each year for one monthly fee, with a discount on other treatment. Payment plans are available for larger treatment such as crowns and Invisalign, and we will always give you a written estimate before any work begins so there are no surprises when the bill arrives.</p>
<h2>Meet the team</h2>
<p>Our team includes two dentists, three hygienists and a front-desk team who will help you with scheduling and insurance questions.</p>
<h4>Dr. Rivera</h4>
<p>Dr. Ana Rivera founded Brightside Dental in 2014 after ten years in practice in San Antonio. She is a member of the American Dental Association and the Texas Dental Association, and she has a special interest in nervous patients and children's dentistry.</p>
<h2>Frequently asked questions</h2>
<details><summary>Do you accept new patients without a referral?</summary><p>Yes. You can book online or call us, and most new patients are seen within a week.</p></details>
<details><summary>Do you see children?</summary><p>Yes, we see children from their first tooth, usually around age one.</p></details>
<details><summary>What should I do in a dental emergency?</summary><p>Call the office first thing in the morning. We hold emergency slots every weekday.</p></details>
<details><summary>Is there parking?</summary><p>Yes, free parking is available behind the building.</p></details>
<details><summary>Do you offer sedation?</summary><p>We offer nitrous oxide for anxious patients at no extra cost.</p></details>
<details><summary>Which insurance plans do you take?</summary><p>Most major PPO plans. Call us with your plan details and we will check your cover.</p></details>
</main>
<footer><p>Brightside Dental, South Lamar, Austin. Call us on (512) 555-0142.</p></footer>
</body>
</html>`;

const report = analyse(
  {
    html,
    finalUrl: PAGE_URL,
    statusCode: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
    redirects: [PAGE_URL],
    robots: {
      status: "found",
      httpStatus: 200,
      text: [
        "User-agent: GPTBot",
        "Disallow: /",
        "",
        "User-agent: CCBot",
        "Disallow: /",
        "",
        "User-agent: Google-Extended",
        "Disallow: /",
        "",
        "User-agent: *",
        "Disallow: /wp-admin/",
        "",
        `Sitemap: ${ORIGIN}/sitemap.xml`,
      ].join("\n"),
      sitemaps: [`${ORIGIN}/sitemap.xml`],
    },
    llms: { found: false, httpStatus: 404, note: `${ORIGIN}/llms.txt returned 404` },
    sitemap: { found: true, url: `${ORIGIN}/sitemap.xml`, via: "robots.txt" },
    warnings: [`The address redirected 1 time; results are for ${PAGE_URL}.`],
  },
  "https://brightsidedental.example/",
);

report.fetchedAt = "2026-10-24T09:30:00.000Z";
report.durationMs = 3180;

const out = new URL("../src/dev/sample-report.json", import.meta.url);
writeFileSync(out, JSON.stringify(report, null, 2) + "\n");
console.log(`Sample report: ${report.overallScore} (${report.grade}), ${report.fixes.length} fixes -> ${out.pathname}`);
console.log(report.verdict);
