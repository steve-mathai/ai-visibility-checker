# Security audit

Audit date: 7 Nov 2026. Audited commit: `de062e6`. Method: the `security-audit` skill in full-audit mode, standard profile. The full run record lives outside the repo at `C:\Users\Steve\security-audit-skill\ai-visibility-checker\run-1\` (REPORT.md, NEEDS-VALIDATION.md, findings.json, coverage-ledger.json).

## How the audit ran

- **Coverage.** 27 coverage units across the two API routes, the fetcher and SSRF guard, the HTML, robots, llms and sitemap parsers, the checks, the Claude summary, the client and the config. 10 hunters ran in 4 waves, with a coverage critic after each wave and a final clean critic that found nothing missing. Each candidate then went to a fresh verifier (Phase 3), and each surviving record to another fresh verifier (Phase 5).
- **Source-only.** This Windows machine has no OS-enforced sandbox, so the audit ran no app code and probed nothing over the network. The skill only marks a finding "confirmed" after reproducing it locally, so all 7 findings are **needs validation**. Each one has a source trace that two independent verifiers agreed on, plus a bounded test plan.
- **Priority column.** The skill gives no severity to unconfirmed findings. The priority below is my own estimate of what the finding would be worth if confirmed, used to order the work. It is not an audit verdict.

## Findings and fixes

| # | Finding | Est. priority | Fix | Status |
|---|---|---|---|---|
| 1 | **SSRF via DNS rebinding.** The guard checked one DNS answer, then `fetch` resolved the name again before connecting. | High | Requests now go through `node:http`/`https` with a `lookup` hook that hands the socket only the addresses already validated, keeping the Host header and SNI. One resolution covers each hop, and every redirect hop is re-validated. | Fixed, with tests |
| 2 | **Spoofable rate-limit key, unbounded Map.** The limiter keyed on the client-sent `x-forwarded-for`, and its Map had no cap. | Medium | The limiter moved onto `src/lib/store`: Upstash/Vercel KV when env vars exist, else a bounded in-memory LRU. Proxy headers are trusted only with `TRUST_PROXY=1`, which takes the last hop. On top of that: a global in-flight cap of 6 audits per instance, and a daily summary budget. | Fixed, with tests |
| 3 | **robots.txt regex backtracking (ReDoS).** Attacker wildcard patterns were compiled to `.*` regexes and tested against an attacker-chosen path. | Medium | A linear, non-backtracking glob matcher, with caps on rules, pattern length and rule text (200 chars). | Fixed, with tests |
| 4 | **Quadratic CPU in parsing.** `Array.includes` dedupes ran over uncapped arrays built from page markup. | Medium | `Set`-based dedupe and caps on sections, links, phone matches and schema types. | Fixed, with tests |
| 5 | **Memory amplification.** The full body was cloned twice per page. | Medium | Text extraction is a single linear walk with no clone and no DOM mutation (a 20k-section page went from ~12 s to 1.3 s). Heavy extraction is skipped above 150k elements, and the 8 MB cap stays. | Fixed, with tests |
| 6 | **Unabortable DNS lookup.** `dns.lookup` ignored the abort signal and could pin the libuv pool. | Low | A 3 s per-lookup timeout, raced against the request deadline and the client's disconnect signal. Lookups are cached per audit, and the cached answers are re-validated on each use. | Fixed, with tests |
| 7 | **Unescaped fix snippets.** Copyable snippets embedded page text with no HTML or script escaping. | Low | Shared `escapeHtml` and `safeJsonForScript`, which escapes `<`, `>`, `&` and U+2028/9 in JSON-LD. | Fixed, with tests |

The regression tests are in `src/lib/audit/__tests__/hardening.test.ts`, `ratelimit-summary.test.ts` and `ssrf.test.ts`.

## Other hardening from the hunters' notes

- **Security headers** in `next.config.ts`:
  - CSP, HSTS, `X-Frame-Options: DENY` and `frame-ancestors 'none'`, `nosniff`, Permissions-Policy and COOP;
  - Referrer-Policy is `no-referrer` on `/report` (its URL carries the audited address) and `strict-origin-when-cross-origin` elsewhere.
- **SSRF block list** now also covers:
  - 6to4, Teredo, the NAT64 local-use range, SIIT and the documentation ranges;
  - 192.88.99.0/24 and the Azure wireserver address;
  - more internal hostname suffixes.
  Ports are still limited to 80 and 443, and that check still runs before DNS.
- **No DNS oracle.** "Does not resolve" and "resolves to a private address" now return the same message and code.
- **No internal details in errors.** No env-var names, key state, provider errors, or target-controlled content-type or `llms.txt` text are sent to clients.
- **Summary route:**
  - summaries are bound to real audits by an HMAC-signed `summaryToken` (24 h expiry, constant-time compare);
  - summaries are cached per URL for 24 h;
  - the route runs under a daily budget (`SUMMARY_DAILY_LIMIT`);
  - the retry and timeout now fit inside `maxDuration`.
- **Request limits.** Both POST routes require `application/json`, cap the body (4 KB for audit, 128 KB for summary) and pass on the request's abort signal.
- **Prompt injection.**
  - The page digest is wrapped in `<audit_data>`, with `<` and `>` escaped and invisible characters stripped.
  - Collections are capped before serialising, so the JSON is never cut mid-structure.
  - Output uses a JSON schema and is validated by zod.
  - Model output only ever renders as React text.
- **API key is server-only.** `ANTHROPIC_API_KEY` is read only in server modules and never reaches the client bundle.
- **Process:** `SECURITY.md` (how to report), `.github/dependabot.yml` (npm and GitHub Actions, weekly), and the new variables in `.env.example`.

## Dependency and secrets scan

- **`npm audit`:** 8 moderate, all in dev-only tooling (a `minimatch` ReDoS reached through `typescript-eslint` / `eslint-config-next`). The only fix npm offers is a semver-major downgrade of the lint stack, which would break linting. Nothing reaches the production bundle or runtime, so this is **accepted as dev-only**. Dependabot will raise the upgrade when upstream ships it.
- **Secrets scan:** clean across all 4 commits and the working tree. No keys, tokens or `.env` files are committed (`.env*` is gitignored except `.env.example`).

## What still needs the owner

These are facts the source can't show. Check them on a staging deployment, never production.

1. **Proxy headers.** Does Vercel overwrite `x-forwarded-for`? If it does, set `TRUST_PROXY=1` so limits key on the real client.
2. **Concurrency model.** Do concurrent requests share one Node process? This decides how much the remaining CPU and memory bounds matter.
3. **Private egress.** Can the deployment reach private ranges or a metadata endpoint at all? This is defence in depth on top of the pinning.
4. **Anthropic spend cap.** Set a monthly cap in the Anthropic console, alongside `SUMMARY_DAILY_LIMIT`.
5. **KV store.** Add Upstash or Vercel KV env vars so rate limits and the summary cache are shared across instances. Without them, both are per instance.
