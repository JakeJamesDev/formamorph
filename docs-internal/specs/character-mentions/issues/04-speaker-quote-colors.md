# 04: Speaker Quote Colors

Status: ready-for-agent
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
- **Changelog:** a fragment for the feature.

## Acceptance criteria

- [ ] A quote with a resolved speaker renders in that speaker's palette color. The same entity gets the same color across turns and reloads.
- [ ] Unresolved quotes and turns with the feature off render as today. The existing quote tests stay green with no changes.
- [ ] Turning quote coloring off in Display settings also turns speaker colors off.
- [ ] Every palette color meets the contrast target against the narration background in both themes. A test computes it.
- [ ] Frames: `.scratch/frames/quote-colors-light.png` and `quote-colors-dark.png`, with three speakers, at desktop width.

For you: approve the palette, and judge whether the colors help or distract in play.
