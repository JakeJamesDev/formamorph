# 02: Color Quotes in Choice Buttons

Status: ready-for-human
Status note: Built in "Color Quotes In Choices". A selected choice keeps its span with an inline `color: inherit`, so ticket 03 italic still applies.
Base: 7e2c092e
Blocked by: 01
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium

Spec: `docs-internal/specs/quote-color/spec.md`

## What to build

Quoted speech inside a choice button shows in the dialogue color, under the same switch as narration.
Choices are not markdown; the existing manual bold split gains a quote pass.

## Acceptance criteria

- [x] The choice path calls the shared quote segmenter and emits the same span class.
- [x] Bold runs inside choices keep working next to and inside a colored quote.
- [x] The switch off leaves choices plain.
- [x] A GamePanels harness test covers a choice with a quote, a choice with bold inside a quote, and the switch off.
- [x] Verified in the preview via the dev-router in both modes.
- [x] Four gates green.
