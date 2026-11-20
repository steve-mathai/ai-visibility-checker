# AI Visibility Checker: brand

## The mark: [/] root bracket

Two square citation brackets around a single forward slash. The slash is the root path in robots.txt's `Allow: /`; the brackets are the way an AI answer cites a source. Meaning: your whole site, cited.

Why it was chosen:
- **16 px legibility.** Three heavy vertical-ish forms with a clear gap read as "[/]" even when the detail is gone. The lime slash is the only coloured thing, so the eye lands on it.
- **Mono.** Drop the lime and the ink slash still separates cleanly from both brackets (clear gap on each side), on black-on-white and white-on-black.
- **Meaning.** It says "citation" and "root" in one glyph, with no stock icon vocabulary.

## Construction

- 64 x 64 grid, mark spans 8 to 56 on both axes.
- Brackets: stem 7 wide, serifs 7 thick and 7 long beyond the stem, outer edges at x 8 and 56, height 48.
- Slash: a parallelogram 6.4 wide (horizontal), leaning right, 40 tall (y 12 to 52), centred between the brackets. Behind it, the lime parallelogram (16 wide at the base, 8 to 56 tall) is the highlighter block.
- Clear space: the width of the slash (about 6.4 units, 10% of the mark height) on all sides. Minimum size: 16 px.
- Favicon variant is heavier (stems 9, serifs 9) on a tile, see below.

## Palette

| Name | Hex | Use |
|---|---|---|
| Ink (slate) | `#14232B` | Brackets, slash, type on light grounds |
| Frost | `#F4F7F8` | Default ground, ink-on-dark type |
| Citation lime | `#D9F24E` | Highlighter fill |
| Paper white | `#FFFFFF` | Alternate ground, mono white |

Lime contrast rule: on light grounds lime is only ever a fill behind or beside ink shapes, never thin lines or text. Foreground lime (the slash itself) is used only on dark grounds.

## Files

| File | Use |
|---|---|
| `logo.svg` | Mark + wordmark for light grounds (headers, docs) |
| `logo-dark.svg` | Mark + wordmark for dark grounds: frost ink, lime slash |
| `mark.svg` | Standalone colour mark on light grounds |
| `mark-mono.svg` | Single colour, `currentColor`, inherits the surrounding text colour |
| `mark-mono-black.svg` / `mark-mono-white.svg` | Fixed single colour for print or one-colour reproduction |
| `favicon.svg` | Heavier 16 px mark on an ink tile (frost tile in dark mode via `prefers-color-scheme`) |
| `icon-32.png` | Favicon fallback |
| `icon-180.png` | Apple touch icon, solid frost ground, about 12% padding |
| `icon-192.png`, `icon-512.png` | Web manifest icons, same treatment |
| `icon-512-maskable.png` | Maskable icon, mark inside the 80% safe zone on solid frost |
| `og-default.png` | 1200 x 630 social card |
| `directions/b-root-bracket/` | Source of record for the chosen mark |
| `directions/board.html`, `board-light.png` | Step 1 comparison board |
| `alternatives/` | Directions A and C, kept for reference |

The wordmark in `logo.svg` / `logo-dark.svg` is live `<text>` in Clash Grotesk 500. Where the font is not loaded (for example inside an `<img>`), it falls back to a system sans stretched to the same width. For guaranteed fidelity, inline the SVG on a page that loads Clash Grotesk.

## Don'ts

- No gradients, shadows, glow or outlines on the mark.
- No lime as thin lines or text on a light ground.
- Do not rotate, skew, recolour or re-space the brackets and slash.
- Do not add a letter, rounded container or other icon around the mark (the favicon tile is the only exception).
- Do not go below 16 px or crowd the clear space.
- Do not use the colour mark on mid-tone or busy photographic grounds; use a mono version.

## Alternatives

**A. The citation** (`alternatives/a-citation/`). The name as a wordmark followed by a superscript `[1]` on a slightly rotated lime highlighter block, exactly as an AI answer cites a source. Very on-theme, but it leans on the wordmark and the numeral gets small at 16 px.

**C. The switch** (`alternatives/c-switch/`). The signature robots switch reduced to a capsule with a lime knob carrying an ink slash. Bold and memorable in mono, but it sits closer to a generic toggle icon and carries less "citation" meaning.

© 2026 Steve Mathai Mathew. All rights reserved.