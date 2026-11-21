# Phases

Each phase ends in something shippable. Exit criteria are what has to be true before moving on.

## Phase 0: Setup (done, 24 Oct 2026)

- Next.js 16 + TypeScript + Tailwind 4 scaffold, git repo, shared types contract.
- Exit: app builds, contract agreed between engine and UI.

## Phase 1: MVP (done, 25 Oct 2026)

- Audit engine: safe fetching, robots.txt for 14 crawlers, 29 checks across five categories, weights, caps, fix ranking.
- Landing page with the two-line AEO/GEO explainer, report page with shareable URL, sample report, error states, demo email capture.
- Optional Claude summary with graceful fallback.
- 47 unit tests, real-site testing on 10 pages, README case study, screenshots.
- Exit (met): runs locally, correct results on a strong, a weak, a JS-only and a bot-blocking site; build, lint, types and tests all green.

## Phase 1.5: Launch hardening (next)

Goal: safe to share publicly.

- Done 26 Oct 2026: full UI redesign to the tasteskill direction (see `docs/design.md`), which absorbed the old polish backlog, print view included.
- Done 7 Nov 2026 (uncommitted, awaiting the owner's OK to commit):
  - **Security audit and hardening.** 7 findings, all fixed with regression tests; see `docs/security-audit.md`. This covers:
    - the DNS-rebinding gap, closed by pinning the validated IP;
    - a rate-limit store adapter (Upstash/Vercel KV, with an in-memory LRU fallback);
    - a 24 h per-URL summary cache, an HMAC summary token and a daily budget;
    - security headers;
    - `SECURITY.md` and Dependabot.
  - **Rebrand.** A new "[/]" mark and asset set in `brand/`, with the palette re-tuned to ink, frost and citation lime, plus the favicon, manifest and default OG card. A per-report share image comes from `/api/og` (host only; a score taken from the URL is never trusted). Also added: the copyright footer, `LICENSE` and the README section.
- Deploy to Vercel (owner approval needed). Decide on domain. Set `TRUST_PROXY`, the KV env vars, `SUMMARY_SIGNING_SECRET` and `SUMMARY_DAILY_LIMIT`, and an Anthropic spend cap.
- Run the AI summary end to end with a real key; check output quality on 5 sites and tune the prompt.
- Privacy-friendly analytics (Vercel Analytics or Plausible) with events: audit started, audit finished, fix snippet copied, share link copied, email submitted. Owner to choose the provider.
- Validate the audit's deployment questions on staging (proxy headers, concurrency model, private egress); see `docs/security-audit.md`.
- Exit: live URL, summary verified, analytics recording, rate limit and cache shared across instances.

## Phase 2: Lead capture and re-check

Goal: turn one-off audits into a relationship.

- Wire `LeadCapture` to an email or CRM tool (to be chosen; see prd.md open questions), with consent text and double opt-in.
- Store the audited URL and last score per subscriber (small Postgres, e.g. Neon).
- Scheduled monthly re-audit (Vercel Cron) and an email when the score drops or a new blocker appears.
- Exit: a test subscriber receives a correct re-check email; unsubscribe works.

## Phase 3: Citation tracking

Goal: close the gap between "can be cited" and "is cited".

- For a brand and 20 to 30 buyer questions, query answer-engine APIs weekly and record which domains are cited.
- Show share of citations against named competitors over time.
- Exit: tracking runs for 3 brands for 4 weeks with stable, explainable numbers.

## Phase 4: Wider audits (done, 21 Nov 2026)

- Competitor comparison: up to four URLs side by side.
- Multi-page audit: sample 20 to 50 URLs from the sitemap and report template-level patterns.
- Built: `POST /api/compare` and `/compare`, `POST /api/site` and `/site` (see `docs/architecture.md`, "Wider audits"). Entry points are links on the report page and in the landing nav.
- Exit: a 40-page audit finishes in under 60 seconds and its patterns are verified by hand on one site.
  - Met in tests: `wide.test.ts` runs a 40-page audit against injected fakes with 1 s of simulated latency per page and finishes well under 60 s (the test logs the wall time). The route stops itself at 55 s and returns a partial result.
  - Not done: the by-hand check of the patterns on one real site. No audit was run against an outside website while building this phase, so the owner or a later run should do that once.

## Phase 5: Validate the weights

- Use Phase 3 citation data to test which checks predict being cited, then re-weight.
- Publish the method and the findings (also a good content piece for the lead magnet).
- Exit: a documented re-weighting with before and after accuracy on a held-out set of sites.
