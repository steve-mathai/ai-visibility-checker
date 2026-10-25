# Rules

Working rules for this project, for people and for AI coding agents. If a rule here conflicts with a habit, the rule wins. If a rule is wrong, change this file in the same commit as the code.

## Product and copy

1. **No promises.** The tool estimates citability from on-page signals. Never say or imply that a fix will get a page into ChatGPT, Perplexity or AI Overviews.
2. **Label what's unproven.** llms.txt and any other emerging tactic gets a plain caveat and low points. Don't inflate a check because it's fashionable.
3. **Training bots are not a penalty.** Blocking GPTBot, ClaudeBot, CCBot, Google-Extended, Applebot-Extended or meta-externalagent is a business choice. Report it as information, never take points off for it.
4. **Respect deliberate blocks.** Fix text for blocked answer bots explains the cost and leaves the decision to the business; it doesn't tell a publisher they're wrong.
5. **Every warn or fail has a fix.** The fix has a `why` (1 to 2 sentences, for a marketer), a concrete `how`, an impact and an effort. Add a `snippet` whenever something can be pasted, and build it from the page's real data (site name, URL, logo), not placeholders, unless the data doesn't exist.
6. **Copy voice:** plain English, short words, no exclamation marks, no emoji, no em or en dashes, no hype words (unlock, supercharge, revolutionise, game-changer, seamless, robust, leverage). Explain jargon the first time it appears.
7. **Landing page claims match the code.** If `src/components/categories.ts` says we check something, a check in `src/lib/audit/checks/` must do it.
8. **The sample is real output.** `/report?demo=1` must come from `scripts/generate-sample.ts`. Never hand-edit `src/dev/sample-report.json`.

## Scoring

9. Category weights live in one place (`score.ts` `CATEGORIES`) and must sum to 1. The landing page's percentages must match.
10. Caps are only for problems that make the rest irrelevant (can't index, can't crawl, can't read). Don't add a cap for anything an engine could work around.
11. A page that was cut off at the size limit must never be labelled JavaScript-only.
12. "Local business" means a LocalBusiness-type entity in markup, not the presence of an address.
13. When a rule produces a surprising result on a real site, check it against the raw HTML or robots.txt before trusting it. Record the outcome in `docs/memory.md`.

## Engineering

14. `src/lib/audit/types.ts` is the contract between server and client. It has no runtime imports. Changing it means updating both sides and regenerating the sample in the same commit.
15. Checks are pure functions of `AuditContext`. No network calls inside a check; all fetching happens in `index.ts`.
16. Tests never touch the network. Use fixtures and `analyse()`.
17. Every outbound request goes through `safeFetch`. Never call `fetch` on a user-supplied URL directly, and never weaken the SSRF guard to make a site work.
18. The fetcher identifies itself honestly. Never spoof Googlebot or another real crawler's user agent.
19. The AI summary route returns HTTP 200 with `{enabled: false, reason}` on every failure. The rule-based report must be complete without it.
20. Claude API usage follows the current `claude-api` skill: model `claude-opus-5-5` unless the owner chooses otherwise, structured output via `output_config.format`, server-side fallbacks on, `stop_reason` checked before reading content. No `temperature`, `budget_tokens`, disabled thinking or assistant prefill.
21. Under `cacheComponents`, anything that reads `searchParams` sits inside `<Suspense>`. Don't add `dynamic` or `runtime` exports to routes.
22. Before committing: `npx tsc --noEmit`, `npx eslint src scripts`, `npm test`, and `npx next build` all pass.
23. After changing any check: regenerate the sample, re-run the real-site script, and update the results table in the README if scores moved.

## Environment (this machine)

24. Run npm and npx from PowerShell, not Git Bash (node isn't on Git Bash's PATH here).
25. If `npm install` fails with ENOTEMPTY, delete `node_modules` (`cmd /c rmdir /s /q node_modules`, twice if needed) and reinstall with `--prefer-offline`. Don't read files under `node_modules` while npm is running.
26. The dev server for this project uses port 3217. The workspace-level `.claude/launch.json` belongs to another project; don't edit it.

## Git, publishing and money

27. Commit as the personal identity (Steve Mathew, `347987316+steve-mathai@users.noreply.github.com`), set per repo. Check `gh api user --jq .login` returns `steve-mathai` before any push.
28. Never push, deploy, change repo visibility, or add paid services without the owner's go-ahead for that specific action.
29. Never commit `.env*` files other than `.env.example`, or any key or token.
30. Never publish claude.ai Artifacts for this project. Deliverables are files in the repo.
