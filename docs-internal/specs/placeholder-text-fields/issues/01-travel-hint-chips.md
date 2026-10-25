# 01: Travel Hint Chips

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Connections are new ground for placeholders: roll priming, the resolved world, placement letters and the Test Bench have no connection input today, and link/unlink touch placement ids. Many seams, so Opus at high.

## Parent

`docs-internal/specs/placeholder-text-fields/spec.md`

## What to build

A connection's Travel Hint boxes become single-line chip fields. The author inserts chips with the `{` typeahead, the palette strip or a drag. The box keeps its focus request from the map canvas.

- **Link** copies the first leg's text exactly, placement ids included, so a Unique chip reads one roll both ways (spec Q2).
- **Unlink** gives the second leg fresh placement ids, so each direction rolls on its own and the pair reads as unlinked (Q2b).
- **Play.** Roll priming reads connection hints, so a Unique chip in a hint rolls once per playthrough. Location context sends the resolved hint against global placeholders and the active pins, the current location's included (Q6). The AI Context instrument keeps showing resolved text (Q3).
- **Editor canvas.** A chip-bearing edge label shows values in braces. The game map keeps hiding edge labels (Q3).
- **Lists.** Connection hints join the world placement texts (placement letters), the Test Bench chip owners (rules, opening priming, placed ids) and world search as a new chip-capable target.
- A deleted placeholder shows the red `?` pill in the box and resolves to nothing in play.

Ship with it: the supported-fields list and the placement-letter order in the World Editor Placeholders help page name Travel Hints. A changelog fragment.

- [ ] A chip inserted by typeahead, palette click and drag lands in a Travel Hint box.
- [ ] A canvas edge click still focuses the matching leg's box.
- [ ] Linking copies the first leg's tokens with the same placement ids.
- [ ] Unlinking re-mints the second leg's placement ids, and the link toggle then reads unlinked.
- [ ] A Unique chip in a linked hint resolves to one value in both directions of location context.
- [ ] A Unique chip in a hint keeps one value across renders and turns (priming covers hints).
- [ ] Location context resolves a hint with the current location's pin over the roll.
- [ ] The editor canvas edge label shows the braces form; the game map shows no label.
- [ ] Placement letters, Test Bench chip owners and world search each include connection hints, each proven by a test that fails with the hint removed from that list.
- [ ] The help page lists Travel Hints.

## Comments
