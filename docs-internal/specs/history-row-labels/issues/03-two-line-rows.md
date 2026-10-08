# 03: Two-line rows

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: visual work against an approved prototype, with flex truncation, opacity muting over dimmed rows, and checks in both themes.

Parent: [History Row Labels spec](../spec.md)

## What to build

History rows show the label as parts, in the layout the user picked in the prototype (`prototype/history-labels`, default toggle set).

- **Named row, line one:** the record's name in italics, which truncates first, then the field as a small bordered chip, which never truncates.
- **Named row, line two:** verb and type at the meta size, muted by reduced opacity (not a gray color), so an undone row's dimming still applies to them.
- **Nameless row:** one line with verb, type and the field chip when there is one. It is not muted and does not repeat its words. A labeled batch shows its label.
- **Unchanged:** the Now marker, the Saved marker, the World opened head, undone dimming, the `(undone)` text and `aria-current`.
- **Popover width:** 20rem, keeping the 90vw cap.
- **Design system:** the HistoryControls design-system reference shows the new rows. It is the approved new pattern, signed off in the prototype review on 2026-10-08.

## Acceptance criteria

- [ ] Render tests: a named row shows its name and field, and its accessible name is still the full label. A nameless row renders its verb and type once. An undone row keeps its undone text.
- [ ] Guard bites: putting the flat single-span row back fails the field-present test.
- [ ] Live check through `verify-ui` at a realistic viewport, in light and dark themes, with: a long name plus a long field (the name truncates, the chip stays whole), a nameless row, an undone named row (the muted parts are no brighter than the dimmed name), and the current row.
- [ ] The mobile History icon popover shows the same rows and stays inside the screen.
- [ ] Changelog fragment written.
- [ ] Four gates green.
