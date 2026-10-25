# Design

## Principles

1. **Credible over flashy.** This is a diagnostic tool people will forward to their boss or developer. It should look like a well-made product, not a growth hack.
2. **Answer first.** The score, grade and one-sentence verdict are visible without scrolling. Detail is one click away, never in the way.
3. **Every number explains itself.** Scores show their weight, checks show their points and evidence, caps show their reason.
4. **Calm states.** Loading shows what is happening. A missing AI key or a failed summary is a quiet note, not an error.
5. **Same look everywhere.** One accent colour, one type family, one card style, one button system.

## Colour tokens

Defined as CSS variables in `src/app/globals.css` and exposed to Tailwind through `@theme inline` (`bg-surface`, `text-muted`, `text-pass` and so on). Light is the default; dark follows `prefers-color-scheme`.

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `canvas` | `#f7f7fb` | `#0c0c18` | Page background |
| `surface` | `#ffffff` | `#14142a` | Cards |
| `surface-2` | `#f0f0f7` | `#1c1c38` | Hover fills, snippet blocks |
| `line` / `line-strong` | `#e3e3ee` / `#cfcfdf` | `#2a2a49` / `#3a3a60` | Borders |
| `fg` | `#14142b` | `#ededfa` | Body text |
| `muted` | `#55556e` | `#a2a2bd` | Secondary text |
| `accent` | `#4338ca` | `#9a9cff` | Primary buttons, links, focus ring |
| `accent-soft` | `#eceafd` | `#23234a` | Badges, selection, sample banner |
| `pass` / `pass-soft` | `#15803d` / `#e3f6e9` | `#4ade80` / `#12301f` | Passed checks, scores 75+ |
| `warn` / `warn-soft` | `#a15207` / `#fdf1d3` | `#fbbf24` / `#36290d` | Warnings, scores 50 to 74 |
| `fail` / `fail-soft` | `#b91c1c` / `#fde8e8` | `#f87171` / `#3a1717` | Failures, scores under 50, cap banner |
| `info` / `info-soft` | `#3f4f66` / `#e8edf4` | `#9fb0c9` / `#1d2638` | Informational checks, training-bot rows |

Score colour comes from `scoreTone()` in `src/components/format.ts`: 75 and above is pass, 50 to 74 is warn, below 50 is fail. Status is never shown by colour alone; every status also has an icon and a text label.

## Typography

- Geist Sans for everything, Geist Mono for snippets, both via `next/font`.
- Hero H1 around 3rem with tight tracking; section headings around 1.5 to 1.875rem; body 1rem at line-height 1.6; secondary text 0.875rem in `muted`.
- Sentence case for all headings and buttons.

## Layout

- Max content width about 1100px, centred, with a 16px gutter on phones.
- No horizontal scroll at 375px (checked on landing and report pages).
- Landing: hero with URL form, "What we check" grid (3 columns, 1 on phones), "How the score works", an honesty note, closing call to action.
- Report: header (host, URL, fetched time, share and re-run buttons), score hero, in-page jump links, category cards, fix list, crawler table, AI summary, lead capture, disclaimer.

## Components

| Component | Notes |
| --- | --- |
| `.card` | 1rem radius, 1px `line` border, `surface` fill, soft shadow |
| `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-sm` | 2.5rem min height (2rem small), 0.75rem radius, semibold |
| `UrlForm` | Large input plus primary button inside an accent-ringed container; accepts addresses without `https://`; inline validation; example chips below |
| `ScoreGauge` | Inline SVG ring, animated sweep on load, score and grade badge in the centre |
| `CategoryCard` | Label, weight, score bar and number; expands to the list of checks with status icon, points, summary, collapsible evidence and a link to its fix |
| `FixList` | Numbered cards: title, impact and effort badges, category, points available, why, what to do, snippet with Copy button; top 5 shown, rest behind "Show N more" |
| `BotTable` | Bot, operator, purpose, allowed or blocked, deciding rule, with a legend explaining the three purposes; training bots shown in neutral tones |
| `AiSummaryPanel` | Skeleton while waiting, then summary, top actions and current → suggested rewrite cards with Copy; a quiet one-line note when disabled |
| `LoadingSteps` | Four steps that advance on a timer (fetching, robots.txt, structured data, scoring), announced via `aria-live` |
| `ErrorState` | Message per error code with a retry button |
| `LeadCapture` | Email box after the report, honest "demo only" note in v1 |

## Motion

- Gauge sweep 1000ms with an ease-out curve; loading steps fade and rise 4px over 300ms.
- `prefers-reduced-motion` turns all animation and smooth scrolling off.

## Accessibility

- Visible 2px accent focus ring on every interactive element.
- Labelled inputs, real `<button>` elements, `aria-expanded` on collapsibles.
- Loading progress announced through an `aria-live` region.
- Status icons paired with text; colour contrast checked in both themes.
- Report pages are `noindex` (they're per-user output, not content).

## Voice

Plain, specific and calm. Short words. No exclamation marks, emoji or hype. Say what was found, why it matters, and what to do, in that order. When something is uncertain, say so in the same sentence.

## Screenshots

Current screenshots live in `docs/screenshots/`. Desktop shots were taken with headless Edge at 1280px; the phone shot was taken at 390px with device emulation through the DevTools protocol.
