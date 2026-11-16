# 04: Speaker Quote Colors

Status: done
Blocked by: 03
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

## What to build

Each quote in narration takes its speaker's color.

- The quote segmenter gains an optional speaker per quoted run, from the turn's Mention Reading.
- The renderer sets the speaker's color through a CSS custom property on the quote span. The plugin arrays stay stable references, because Streamdown memoizes on them.
- **Color source:** a stable palette index keyed by entity id. Ticket 05 adds the pinned color in front of it.
- **Palette:** build a theme-safe palette that reads well in light and dark. The palette is a new visual pattern, so add it to the design system and get the user's approval.
- Unresolved quotes keep today's theme dialogue color. The existing quote-color settings still control all coloring.
- Colors apply once the reading arrives, with no layout shift.
- **Prototype:** follow the look of variant A on `prototype/character-mentions` (spec, Further Notes). There, the whole quote, marks included, takes the speaker's color, and clicking a quote opens its speaker's card (ticket 07).
- **Changelog:** a fragment for the feature.

## Acceptance criteria

- [x] A quote with a resolved speaker renders in that speaker's palette color. The same entity gets the same color across turns and reloads. (`MarkdownRenderer.speakers.test.tsx`; slots by cast order per Q45, `speakerPalette.test.ts`; DOM read on `fixture=speakerQuotes` after reload)
- [x] Unresolved quotes and turns with the feature off render as today. The existing quote tests stay green with no changes. (`quoteSpeakers.test.ts` feature-off and no-reading cases; `MarkdownRenderer.dialogue.test.tsx` and `quoteSegments.test.ts` untouched and green)
- [x] Turning quote coloring off in Display settings also turns speaker colors off. (`speakerPalette.test.ts`: every rule reading `--quote-speaker` sits under `[data-quote-color]`; Q44 precedence asserted too)
- [x] Every palette color meets the contrast target against the narration background in both themes. A test computes it. (`speakerPalette.test.ts`: 4.5:1 on background and card, all eight palettes, both modes)
- [x] Frames: `.scratch/frames/quote-colors-light.png` and `quote-colors-dark.png`, with three speakers, at desktop width. (1440×900 viewport; the pane cropped them to the narration column at 1:1)

For you: approve the palette, and judge whether the colors help or distract in play.

## Landed

**Not verified**
- Colors arriving on a live turn (the reading lands after the reveal ends). Tests and the fixture cover a turn whose reading already exists; no live model run was made.

**For you**
- Palette approved 2026-11-15 (`.scratch/character-mentions-04/frames/speaker-palette.png`). Judge whether the colors help or distract in play: `#dev?view=gameViewer&fixture=speakerQuotes` with Character Mentions on.
- `.scratch/character-mentions-04/frames/quote-colors-light.png` and `quote-colors-dark.png`.
- The Design System modal clears Quote Color on the root, so its quote samples (this one and Narration Turn) show uncolored there. That predates this ticket.
