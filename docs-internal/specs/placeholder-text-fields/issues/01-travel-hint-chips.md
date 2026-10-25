# 01: Travel Hint Chips

Status: done
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

- [x] A chip inserted by typeahead, palette click and drag lands in a Travel Hint box. `TravelHintPair.test` (three cases, real Lexical field).
- [x] A canvas edge click still focuses the matching leg's box. `TravelHintPair.test` "focuses the leg a canvas arrow asks for" (mutation-checked); live edge click in the preview focused "Travel Hint to Garden".
- [x] Linking copies the first leg's tokens with the same placement ids. `connectionEditing.test` "with chips"; preview frame `travel-hint-linked.jpg` shows one letter (A) in both boxes.
- [x] Unlinking re-mints the second leg's placement ids, and the link toggle then reads unlinked. `connectionEditing.test` (mutation-checked); preview frame `travel-hint-unlinked.jpg` shows (A)/(B), toggle `aria-pressed=false`.
- [x] A Unique chip in a linked hint resolves to one value in both directions of location context. `useResolvedWorld.travelHints.test`, real providers.
- [x] A Unique chip in a hint keeps one value across renders and turns (priming covers hints). Same test, across renders and moves; fails with hints dropped from the priming list. No turn was stepped.
- [x] Location context resolves a hint with the current location's pin over the roll. `useResolvedWorld.travelHints.test` "down by gas light" vs "up by oil light".
- [x] The editor canvas edge label shows the braces form; the game map shows no label. `locationCanvas.test` plus the live canvas (`past the {red|blue} door`); the game map's existing `label: undefined` is unchanged.
- [x] Placement letters, Test Bench chip owners and world search each include connection hints, each proven by a test that fails with the hint removed from that list. `placementLetters.test`, `rules.test` "a chip in a Travel Hint", `worldSearch.test` "Travel Hints"; each went red with its list entry removed.
- [x] The help page lists Travel Hints. `docs/World-Editor-Placeholders.md`: Where chips work, and the letter order.

## Landed

**Not verified**
- None.

**For you**
- Type `{` in a Travel Hint on a location's Presence tab and on the canvas inspector: the menu and chips should feel like a name field. Frames: `.scratch/placeholder-text-fields-01/frames/travel-hint-linked.jpg`, `.scratch/placeholder-text-fields-01/frames/travel-hint-unlinked.jpg`.
- In play, check a route's `— via` line in the AI Context instrument reads the rolled value.

## Comments
