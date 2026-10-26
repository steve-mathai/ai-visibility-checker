---
version: 2
name: AI Visibility Checker
direction: "The product performs" (tasteskill v2, seed 955256396, sector ai-product)
app-style: "Framed sheet / Generated report" (tasteskill v2 app draw, seed 161146234, kind report)
type: Clash Grotesk 400/500/600 (Fontshare), one family for everything; system monospace only inside real code
colors:
  canvas: "#f7f9fa"     # page ground          dark #0e171b
  surface: "#ecf0f2"    # one tone step         dark #16242a
  surface-2: "#e2e8eb"  # hover / second step   dark #1d2e35
  raised: "#ffffff"     # report sheet, cards   dark #132026
  line: "#dde4e7"       # app fragments only    dark #263a42
  fg: "#1f3038"         # slate ink             dark #e4ecee
  muted: "#5d6b72"      # secondary ink         dark #9db0b7
  accent: "#0d7480"     # teal, the action      dark #4fb8c4
  stage: "#1f3038"      # dark field for the switch section
  pass: "#1d7a4c"
  warn: "#93590a"
  fail: "#b42318"
  info: "#475e68"
type-steps:             # five sizes, no sixth
  small: "clamp(13px … 14px)"
  body: "clamp(17px … 19px)"
  lead: "clamp(20px … 26px)"
  head: "clamp(32px … 64px)"
  display: "clamp(48px … 112px)"
radius: 4px on the page (buttons, fields, tiles); 12px for app cards inside the report; 16px for the report sheet
references:
  - tasteskill v2 (Leonxlnx/taste-skill): house rules, direction, app-screen rules, inspector gate
  - Vercel Web Interface Guidelines (vercel-labs/web-interface-guidelines): accessibility, forms, motion, copy checklist
  - awesome-design-md (VoltAgent): vercel and linear.app DESIGN.md, for component craft only (control sizes, table rhythm, focus states)
---

# Design

Source of truth for how the app looks. When this file and the code disagree, fix one of them in the same commit.

## Order of authority

1. **tasteskill house rules.** No eyebrows or pill badges above headlines, no monospace outside real code, no 01/02/03 numbering, no hairline dividers or 1px outlined boxes on the page, no gradients, no shadows on things at rest, no violet or indigo, no tiny uppercase tracked labels, no icon-topped card rows, no glass, no emoji, headlines two lines or fewer at every width, one `h1` on the first screen, a heading on every section, equal outer margins.
2. **The direction** ("The product performs"): the product proves itself through small, true, working fragments of its own interface at real size.
3. **Palette and type** above.
4. **Section blueprints** below.
5. **Craft references** (Vercel and Linear DESIGN.md): control heights, focus rings, table rhythm. Their gradients and monospace captions are not used; they conflict with rule 1.
6. **Vercel Web Interface Guidelines** apply everywhere as the accessibility and interaction checklist.

Exceptions the inspector allows: inside an element marked `data-ui` (a cropped piece of the product's interface) the product's own conventions apply: 1px control borders, 12px card radius, small labels, a shadow on an open menu. Real tables and form fields may have lines. Real code (robots.txt lines, JSON-LD) is monospace.

## The idea

> On this page, **the one robots.txt line that lets an AI crawler in or keeps it out** becomes **a giant working switch the visitor flips**, and every other claim is shown as a real fragment of the report.

The live thing is the URL field itself: it runs a real audit. The switch section is the second live thing and the page's memorable moment.

## Landing page (a page: tasteskill page rules)

Frame: one pair of outer margins, `max(20px, 4vw)`, used by every section. Content max width 1280px. Sections 160–200px apart on desktop, 96–120px on phones. Left-aligned throughout; the only centred moment is the closing wordmark tile.

### Nav (plain bar, not sticky)
Wordmark "AI Visibility Checker" at body size, weight 500, left. Right: three plain links at small step: "How it works" (#how), "Sample report" (/report?demo=1), "GitHub" (repo URL). No button in the nav; the hero holds the action.

### 1. Hero: headline + working field, report fragment beside it
Desktop: 12-column grid. Columns 1–6: `h1` at display step, weight 500, tracking -0.03em, leading 0.95, two lines exactly:
"Can AI engines / cite your page?"
Each line is wrapped in its own mask span for the signature motion (masked line reveal). Under it, 32px down, the two-line explainer at lead step, max 34ch:
"Search is turning into answers. ChatGPT, Perplexity and Google's AI Overviews reply directly, and cite only a few sources."
"AEO and GEO are about being one of them. Paste a page to see how citable it is and what to fix first."
Then the form (UrlForm), 40px down: one field (label "Page address", visually hidden is not allowed: show the label at small step above the field), placeholder "yourbrand.com/pricing…", `type="url"`-style behaviour but accepting bare domains (`inputMode="url"`, `autoComplete="url"`, `spellCheck={false}`, `name="url"`), filled `surface` field 56px tall, square 4px corners, no outline at rest, 2px accent focus ring; primary button "Check this page" 56px tall beside it. Under the form at small step in muted ink: "Free, no sign-up, about five seconds." and a link "Or open a sample report".
Columns 8–12: the hero fragment (`data-ui`), a real crop of a report built from `SAMPLE_REPORT`: the top of the report sheet (host "brightsidedental.example", fetched line), the score ring at 120px with "76" and "Grade B", the verdict sentence, then three crawler rows from the real bot table (OAI-SearchBot allowed, PerplexityBot allowed, GPTBot blocked, shown as training) with one row in a hovered state. Cropped by the bottom of the first screen (about 75% visible). It sits directly on the `surface` stage with no frame and no device chrome.
Phone: headline at about 12.5vw on two lines, explainer, field and button full width stacked, then the fragment full width, its top 60% visible above the fold.

### 2. Proof: real pages, checked (tile board)
A board of filled tiles, four across, 8px gaps, full content width, `surface` tiles, 4px radius, no borders, no hover lift. First tile is twice as wide, filled `accent`, with the heading (`h2`, head step, accent-fg ink): "Real pages, checked". The other tiles each show a real result: the host at lead step weight 500 top-left, the score at head step with the grade, and one plain line at small step. Each tile links to a fresh audit of that page (`/report?url=…`). Under the board at small step: "Checked on 25 October 2026. Scores change when sites change; each tile re-runs the check now."

Data (from docs/memory.md, do not change without re-running):
- zapier.com/blog (zapier.com/blog/get-started-with-zapier/): 95 A. "Everything in place, llms.txt too."
- ahrefs.com/blog (ahrefs.com/blog/what-is-seo/): 90 A. "Full schema and an FAQ."
- bbc.com/news: 68 C. "Blocks OpenAI's and Perplexity's answer bots."
- anthropic.com: 63 C. "Easy to crawl, no structured data."
- excalidraw.com: 45 D, capped. "Text only appears after JavaScript runs."
- cnn.com: 35 F, capped. "Blocks every AI answer bot."
Six result tiles plus the double heading tile fill two rows of four. Each tile re-runs the check on the exact page that was tested.

### 3. Showcase: one line decides it (full-bleed switch)
A full-bleed field, 92svh tall (86svh on phones), in `stage` (slate) with `stage-fg` ink. Top-left on the page margin: `h2` at head step "One line decides it." and one sentence at body step, max 40ch: "A single robots.txt rule lets PerplexityBot in or keeps it out. Flip it and see what changes for your citations."
The control (`data-ui`): a real two-state switch labelled "PerplexityBot", built in em units at true proportions, then scaled up until it stands about 40vh tall, anchored right of centre and cropped by the section's right edge by about a fifth. It is a real `<button role="switch" aria-checked>` and works from the keyboard. Next to it, at true code size scaled with the control, the robots.txt lines it represents, in monospace (real code):
Allowed: `User-agent: PerplexityBot` / `Allow: /`
Blocked: `User-agent: PerplexityBot` / `Disallow: /`
Flipping it swaps the field between `stage` and `accent` and changes the heading's verdict line beneath the h2 (lead step, weight 500, `aria-live="polite"`): Allowed → "Perplexity can fetch this page and cite it." Blocked → "Perplexity can't fetch this page, so it can't cite it." Default state: Allowed.
Phone: heading top-left, the switch about 130vw wide anchored bottom-left, cropped on the right, thumb within reach.

### 4. How it works: pinned fragment, changing state (id="how")
Two columns. Right (columns 7–12): a sticky stage (`top: 14vh`), `surface` fill, about 520px square, holding one report fragment (`data-ui`) at true size that changes state. Left (columns 1–5): `h2` "How a check runs" at lead step, then three statement blocks each 80vh tall, statement at lead step weight 500, one line at body step:
- "Paste a page address." / "Any public page. We fetch it the way a crawler does, without running JavaScript." → fragment state A: the field with "brightsidedental.example" typed and the button pressed.
- "Then we read what crawlers read." / "robots.txt for 14 AI crawlers, the HTML, structured data, llms.txt and the sitemap." → state B: five category rows with their scores filling in (Crawlability 91, Structured data 77, Content 63, Entity 100, Meta 50 from SAMPLE_REPORT).
- "Fix the top item first." / "Each fix is ranked by impact and effort, with a snippet you can paste." → state C: the top fix card from SAMPLE_REPORT with its badges and snippet and a Copy button.
The active statement is in full ink, the others in `muted` (never faded below 4.5:1). Switch state with an IntersectionObserver and a class; no scroll-jacking. Without JavaScript all three statements and state C show.
Phone: the stage sticks at the top at 46svh, fragment cropped to its active region, statements in 60svh blocks below.

### 5. What it checks: the command list (data-ui)
The capabilities as the product's own command menu, scaled up. First a real search `<input>` at lead-to-head size across columns 1–10, filled `surface`, placeholder "Find a check…", labelled for screen readers "Filter the checks". Beneath it the rows, each at head step, leading 1.1, flush left, full content width; at the right end of each row its weight or role as small filled key-cap-like chips in the text face (real data, no fake shortcuts):
- "AI crawler access" · 30% · "robots.txt rules for 14 crawlers. Answer bots count, training bots are your call."
- "Content structure" · 25% · "One H1, question headings, an FAQ and short answers straight under each heading."
- "Structured data" · 20% · "JSON-LD that parses, Organization or LocalBusiness, sameAs links, a page type."
- "Meta basics" · 15% · "Title, description, canonical, Open Graph and a declared language."
- "Entity signals" · 10% · "One business name everywhere, phone and address that agree, About and Contact pages."
- "Hard caps for blockers" · cap · "noindex caps the score at 25, blocked answer bots at 35, a JavaScript-only page at 45."
- "Ranked fixes" · fix · "Impact × points lost × weight × effort, so the first fix is the best use of the next hour."
- "Plain-English summary" · AI · "One Claude call explains the result and suggests rewrites. Off without an API key."
The selected row sits on a solid accent block (accent-fg ink) and shows its sentence at body step beneath the name. Typing filters; arrow keys and hover move the selection; Enter does nothing destructive. Section heading: the input's visible label above it, `h2` at lead step: "What the score is made of".
Phone: names at 8.5vw, chips dropped, tap to select.

### 6. Closing: first step, already open
Full-bleed field in `accent`, 88svh. Left (columns 1–5), anchored to the bottom: `h2` at display step, two lines, leading 0.92, accent-fg ink: "Check your / page." Under it at body step: "About five seconds. No account. The report gets its own link you can share." and at small step: "The score estimates how citable a page is from what's on it. It doesn't measure actual citations or promise a place in an answer."
Right (columns 7–11), vertically centred: the product's check dialog at true size (`data-ui`, 440px wide, `raised` fill, 12px radius, the dialog's own shadow allowed): title "Check a page", the URL field prefilled with an editable example "yourbrand.com", and the primary button "Run the check" (full width, 52px). Submitting goes to `/report?url=…`.

### 7. Footer: tiles
Two rows of filled tiles, 8px gaps. Upper row (220px): statement tile (cols 1–4): "A free AEO and GEO check, built by Steve Mathew." at lead step, and at small step at the bottom "Scores estimate citability from on-page signals." · navigation tile (cols 5–8): How it works, Sample report, What it checks · source tile (cols 9–12): "The code is open." and the GitHub link at lead step. Lower row (320px): ink tile (cols 1–8, `fg` fill, canvas ink) with the wordmark large and centred; accent tile (cols 9–12) "Check a page" at lead step top-left and a 4px-stroke arrow bottom-right; the whole tile links to the hero field (#check).

### Motion (landing)
- Signature: masked line reveal on the h1, 900ms strong ease-out, second line 110ms later, then explainer and form fade-rise together.
- Section entrances: heading, then text, then fragment, staggered 70ms, rise 20px with opacity, once, triggered by IntersectionObserver; content is visible if JS fails (start state applied by a class that JS adds).
- Feedback on every control: buttons press 1px, rows and tiles change tone on hover, the switch thumb slides 200ms.
- One moving picture: the hero fragment's score ring sweeps in on load.
- Everything off under `prefers-reduced-motion`.

## Report page (an app screen: tasteskill app rules, "Framed sheet / Generated report")

No sidebar. A 48px viewer bar with a 1px bottom rule, `canvas` ground: wordmark left; right: "Copy share link" and "Run another check" as small secondary buttons. Below, a centred column of 1088px max (24px phone gutters), 32px down.

1. **Title row.** `h1` host at 24px/600. A 13px muted line 4px under it: full URL (link, nofollow), "Fetched 25 Oct 2026, 19:16 UTC", "Checked in 4.4 s" (use `Intl.DateTimeFormat` and `Intl.NumberFormat`). Sample reports show a quiet notice under it (warn-soft fill, 13px warn ink, 34px tall): "Sample report for a made-up business. No real page was fetched."
2. **Verdict band.** The verdict sentence at lead step weight 500, max 60ch, beside a 96px score ring (score and grade inside). If `cappedBy` is set, a fail-soft notice directly under: the reason in fail ink, then "Fix this first. The rest of the score can't count until it's solved."
3. **Stat cards**, four across with 12px gaps (2×2 on phones): 13px muted label over an 18/600 tabular value. "Overall score" 76 / 100 · "Fixes to make" 11 · "AI answer bots allowed" 6 of 6 · "Words on the page" 437.
4. **Two charts side by side**, edges aligned with the stat columns. Left: "Score by category", horizontal bars, one per category, weight in the label ("Crawlability · 30%"), value at the bar end, bar colour from the score tone (pass ≥ 75, warn 50–74, fail < 50), each row links to that category's checks. Right: "Crawler access", three short rows (Answer bots, Search bots, Training bots) each showing allowed of total as a filled bar plus the count.
5. **Fix list** in a card titled "Fix these first" with its count. Each fix a row: rank shown by position only (no numerals as ornament; an `<ol>` is correct here), title at 16/600, impact and effort status pills, category, "up to +N pts". Rows expand (`<details>`/button with `aria-expanded`) to show why, what to do and the snippet (monospace code block with a Copy button). Top 5 open by default on desktop, all closed on phones except the first.
6. **Checks table** in a card with tabs (Crawlability, Content, Structured data, Meta, Entity), active tab marked by a 2px accent underline, tab state in the URL hash. Rows 40px: status pill, check title, summary, points right-aligned and tabular; evidence in an expandable row.
7. **Crawler table** in a card: Bot, Operator, Purpose, Access (status pill), Deciding rule (inline code). Header row 13px/600 muted over a 1px rule, rows 37px over lighter rules, training bots' "Blocked" in the info pill, not fail.
8. **AI summary card**: loading skeleton without looping pulse (a static tone block plus "Writing a plain-English summary…"), then summary, top actions (`<ol>`), rewrite rows current → suggested with Copy. Disabled state: one quiet line.
9. **Lead capture**: a quiet card at the end, "Re-check this page every month", email field (`type="email"`, `autoComplete="email"`, `spellCheck={false}`), button "Remind me monthly", and the honest demo note.
10. **Footer line**: the honesty sentence and "Built by Steve Mathew" at 13px.

Loading: the four steps as rows in a card with a determinate feel (done ✓ / current spinner / waiting), `aria-live="polite"`, text ends with "…". Errors: a card with the message, the next step, and the right actions per code (no "Try again" for invalid_url and blocked_host; offer "Check a different page").

Print (`@media print`): hide the viewer bar, buttons, lead capture and a disabled AI card; expand every fix and evidence row; white ground, black ink; avoid breaking a fix row across pages.

## Copy rules

Plain, specific, calm. No exclamation marks, emoji, hype, em dashes. Sentence case for headings and buttons (house voice wins over the guideline's Title Case). Numerals for counts. Loading text ends with "…". Buttons say what they do ("Check this page", "Copy share link", "Remind me monthly").

## Build notes (v2 redesign, 26 Oct 2026)

Where the build departs from the dealt sheet, and why (the skill asks for each redraw and deviation to be stated):

- **Hero.** The dealt hero ("Controls on the sentence") demonstrated a typeface with weight and spacing sliders, so it was redrawn once. The redraw ("Column on one line") left 80% of the first screen empty, which conflicts with the direction's own composition, so the hero follows the direction: headline, explainer and working URL field on the left, a real report crop on the right.
- **Proof tiles.** The blueprint wants customer logos; there are none and the skill forbids invented proof, so the tiles hold real, dated audit results that re-run on click.
- **Command list chips.** The blueprint's key caps would be invented shortcuts; the chips show each check's real weight or role instead.
- **Footer.** The blueprint's "city and local time" tile is on the skill's own banned list (agency micro-meta); it became the open-source tile.
- **Closing field** is 64svh, not 88svh: the taller field left half a screen of empty colour.
- **Switch verdict** is at the lead step, not body: it is the payoff of the page's one interaction.

Inspector result on the production build: landing 0 FAIL; report (`--app`) 0 FAIL, 0 WARN. Landing warnings defended:
- *no-real-pictures / no-footage:* the subject is software; its pictures are its own interface fragments (the sheet's own instruction), and there is no honest footage of "an AI crawler".
- *card-rows @390:* the dealt proof board is a tile grid by design.
- *lopsided @768 on a how-it-works statement:* the statement keeps a readable 60ch measure under a full-width stage.

## Checks before any UI commit

`node <tasteskill>/scripts/lint.mjs src` (0 FAIL), `node <tasteskill>/scripts/inspect.mjs http://localhost:3217/` on the production build (0 FAIL at 1440, 768, 390), the report page inspected with `--app`, `npx tsc --noEmit`, `npx eslint src`, `npm test`, `npx next build`. Then look at every screenshot.
