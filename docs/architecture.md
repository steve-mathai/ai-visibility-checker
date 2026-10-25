# Architecture

## Overview

A single Next.js 16 app (App Router, TypeScript, Tailwind 4) with no database. The landing page and the report shell are static. Two API routes do all the work: one runs the rule-based audit, the other asks Claude for a plain-English summary. The browser calls them in sequence and renders the results.

```
Browser                         Next.js server                         Internet
-------                         --------------                         --------
/            (static landing)
/report?url= (static shell)
   │ POST /api/audit {url} ───▶ route.ts ─ rate limit ─▶ runAudit()
   │                                                    ├─ safeFetch(page) ─────────▶ target page
   │                                                    ├─ safeFetch(/robots.txt) ──▶
   │                                                    ├─ safeFetch(/llms.txt) ────▶
   │                                                    └─ safeFetch(/sitemap.xml) ─▶
   │                                                    parse → checks → score
   │ ◀────────────── AuditReport JSON
   │ render report
   │ POST /api/summary {report} ▶ route.ts ─ rate limit ─▶ generateSummary()
   │                                                    └─ Anthropic Messages API ─▶ claude-opus-5-5
   │ ◀────────────── AiSummaryResponse JSON (or {enabled:false, reason})
```

## File map

```
src/
  app/
    page.tsx                 landing page (static)
    layout.tsx               fonts, metadata, header/footer
    globals.css              design tokens + base components
    report/page.tsx          static shell; <Suspense> around ReportClient
    api/audit/route.ts       POST → AuditReport | AuditError
    api/summary/route.ts     POST → AiSummaryResponse (always 200)
  components/
    landing/                 Hero, WhatWeCheck, HowItWorks
    report/                  ReportClient, ReportView, ScoreGauge, CategoryCard,
                             FixList, BotTable, AiSummaryPanel, LoadingSteps, ErrorState
    api.ts                   typed client wrappers for both routes
    LeadCapture.tsx          email box (demo only, isolated for a CRM later)
    site.ts                  site name, author, repo URL
  dev/
    sample-report.json       engine output for the fictional demo page
    sample-report.ts         exports SAMPLE_REPORT + hand-written SAMPLE_SUMMARY
  lib/audit/
    types.ts                 THE CONTRACT between engine and UI
    index.ts                 runAudit (network) + analyse (pure, used by tests)
    fetch.ts                 normaliseUrl, SSRF guard, safeFetch
    robots.ts                RFC 9309 robots.txt parser + evaluator
    bots.ts                  the 14 crawlers, operator and purpose
    parse.ts                 cheerio HTML → ParsedPage (facts, headings, sections, links, JSON-LD)
    schema.ts                JSON-LD helpers (@graph flattening, type matching)
    context.ts               AuditContext passed to every check
    checks/                  crawlability, structured-data, content, entity, meta, util
    score.ts                 category scores, caps, grade, verdict, fix ranking
    summary.ts               the Claude call
    ratelimit.ts             in-memory per-IP limiter
    __tests__/               vitest: robots, SSRF, full pipeline on fixtures
scripts/
  generate-sample.ts         rebuilds src/dev/sample-report.json from the engine
```

## The audit pipeline

1. **Normalise.** Trim, add `https://` if missing, parse with `URL`. Reject other schemes and credentials in the URL.
2. **Fetch the page.** `safeFetch` follows up to 5 redirects manually and re-runs the SSRF check on each hop. 10 s timeout, 8 MB cap (streamed and cut off). Non-2xx becomes `fetch_failed` with a human message; non-HTML becomes `not_html`.
3. **Fetch side files in parallel** (`Promise.allSettled`, each with its own timeout): robots.txt (6 s), llms.txt (5 s), `/sitemap.xml` and `/sitemap_index.xml` (5 s). A failure here never fails the audit; it adds a warning and assumes the permissive default.
4. **Parse.** cheerio reads the HTML into `ParsedPage`: title, meta tags, headings, H2/H3 sections with their first paragraph, visible word count (nav/header/footer/scripts removed), links, tel links, JSON-LD (arrays and `@graph` flattened, invalid blocks counted), microdata types, and JS-shell signals (empty `#root`/`#__next`, noscript warnings, script count).
5. **Evaluate bots.** Each of the 14 crawlers is run through the robots.txt evaluator for the page's path: most specific user-agent group wins, longest matching rule wins, Allow wins ties.
6. **Run checks.** Five files, each returning `CheckResult[]`. A check has points, max points, status (pass, warn, fail, info), a marketer-facing summary, evidence lines, and a `Fix` when it's warn or fail.
7. **Score** (`score.ts`):
   - Category score = earned / max × 100 over checks with `maxPoints > 0`.
   - Overall = weighted sum (crawlability 0.30, content 0.25, structured data 0.20, meta 0.15, entity 0.10).
   - Caps: noindex → 25; Googlebot and Bingbot both blocked, or every answer bot blocked → 35; JS-only shell → 45. The lowest applicable cap wins and `cappedBy` explains it.
   - Grade: A ≥ 85, B ≥ 70, C ≥ 55, D ≥ 40, else F.
   - Fix priority = impact (3/2/1) × points lost × category weight × effort (quick 1.5, moderate 1, involved 0.6).
   - Verdict: one sentence led by the blocker if there is one, otherwise by grade and the top fix.

`analyse()` takes already-fetched inputs and runs steps 4 to 7 with no network, which is what the tests and the sample generator use.

## The data contract

`src/lib/audit/types.ts` is the only shared surface between server and client. It has no runtime imports. The key types:

- `AuditReport`: url, fetchedAt, overallScore, grade, verdict, cappedBy?, categories[], fixes[], bots[], page (PageFacts), warnings[], durationMs.
- `CheckResult` and `Fix`: per-check outcome and its remedy.
- `PrioritisedFix`: a `Fix` plus checkId, category, pointsAvailable, priority.
- `BotVerdict`: bot, operator, purpose (answer, search, training), allowed, deciding rule.
- `AiSummaryResponse`: `{enabled: true, result}` or `{enabled: false, reason}`.

Changing this file means changing both sides and regenerating the sample.

## The AI summary

`summary.ts` builds a compact digest (scores, failed and warned checks, title, description, H1s, first 25 headings, schema types, business name, a 1,500-character text excerpt) and makes one call:

- `client.beta.messages.create` with model `claude-opus-5-5`, `max_tokens` 16000.
- `output_config: {effort: "medium", format: {type: "json_schema", schema}}` for structured output.
- `betas: ["server-side-fallback-2026-07-01"]` and `fallbacks: "default"`, so a safety-classifier refusal is retried on a fallback model server-side.
- No `temperature`, no `thinking` config, no prefill (all rejected on this model).
- Checks `stop_reason` (refusal, max_tokens) before reading content, `JSON.parse`s the text block, then validates with zod.
- Per-request timeout 55 s, 1 retry, inside the route's `maxDuration = 60`.
- Every failure path returns `{enabled: false, reason}` with HTTP 200, so the UI never shows an error for it.

The posted report is validated with zod and size-capped before it's used, because the client could send anything.

## Security

- **SSRF guard** (`fetch.ts`): http/https only; ports 80/443; no credentials in URLs; blocks `localhost`, `.local`, `.internal`, `.lan`, `.home.arpa`; resolves DNS and refuses if *any* address is loopback, private, link-local (incl. 169.254.169.254), CGNAT, multicast, reserved, IPv6 ULA/link-local, or IPv4-mapped/NAT64 forms of those. Re-checked on every redirect.
- **Known gap:** DNS rebinding between the check and the connect. Closing it needs pinning the resolved IP (undici dispatcher or `node:https` with a fixed lookup).
- **Limits:** 8 MB page body, 512 KB robots.txt, 256 KB llms.txt, 128 KB sitemap probe.
- **Rate limiting:** in memory, per IP, 30 audits and 12 summaries per 10 minutes. Per instance on serverless, so a soft limit only.
- **No secrets in the client.** `ANTHROPIC_API_KEY` is read only on the server.
- **Outbound identity:** the fetcher sends an honest user agent (`AIVisibilityChecker/1.0`) and never pretends to be Googlebot or another real crawler.

## Rendering under cacheComponents

`next.config.ts` enables `cacheComponents`. The landing page and `/report` are prerendered static. `ReportClient` is the only component that reads `useSearchParams`, and it sits inside `<Suspense>` so the rest of the route stays static. The API routes are POST handlers, which are never cached, so they don't need (and can't have) a `dynamic` export.

## Testing

- `npm test` runs 47 vitest tests with no network: robots.txt parsing edge cases, SSRF blocking (including redirect re-validation and the size cap), and full `analyse()` runs on fixture pages (strong, weak, JS shell, noindex, blocked crawlers, truncated page).
- Real-site checks are done by hand with a small script that calls `runAudit` on a list of URLs (see memory.md for the last results).
- `npx tsc --noEmit`, `npx eslint src scripts`, and `npx next build` must all pass before a commit.

## Deployment

Vercel, zero config. Routes set `maxDuration` 30 and 60. Optional env var `ANTHROPIC_API_KEY`. No database, no cron in v1. See README for steps.

## Adding a check

1. Add it to the right file in `src/lib/audit/checks/`, returning a `CheckResult` with a stable `id`.
2. Give every warn and fail a `Fix` with impact, effort, a concrete `how`, and a snippet built from real page data where it helps.
3. Add or update a fixture test in `__tests__/pipeline.test.ts`.
4. If it changes the landing page's "What we check" claims, update `src/components/categories.ts`.
5. Run `npx tsx scripts/generate-sample.ts` so the demo matches.
6. Re-run the real-site script and note any surprises in memory.md.
