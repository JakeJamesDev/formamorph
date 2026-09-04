# Placeholder Multiline Value Editor

Status: ready-for-agent

## Problem Statement

Placeholder values are edited as single-line chips. That fits short values (eye colors, names), but authors have found clever uses for placeholders that carry paragraph-length content — scene flavor, reusable prose blocks — and a chip input is the wrong tool for those: it strips newlines, splits pastes into one chip per line, and gives no room to read or write longer text.

## Solution

Each placeholder's values section gets a small segmented toggle between two editing styles: the existing chip editor, and a multiline view with one markdown-supported edit box per value (the same toolbar + Edit/Preview machinery the readme fields use). Placeholders whose values contain newlines open in multiline automatically. The placeholder data itself is unchanged — same `values: string[]`, same weights, same resolution — only the editing surface changes.

## User Stories

1. As a world author, I want a Chips | Multiline toggle on a placeholder's values section, so that I can pick the editing style that fits that placeholder's content.
2. As a world author, I want a placeholder with any multiline value to open in the multiline view automatically, so that I never see a paragraph squeezed into a chip without asking.
3. As a world author, I want a placeholder with only short values to keep opening in the chip view, so that the common case stays exactly as it is today.
4. As a world author, I want each value in the multiline view to have its own edit box that accepts newlines, so that I can write paragraph-length values.
5. As a world author, I want the multiline boxes to carry the standard markdown formatting toolbar, so that formatting works the way it does in the readme and description fields.
6. As a world author, I want a Preview tab on each multiline box that renders my markdown, so that I can see what the player-facing renderer will show.
7. As a world author, I want a draw-weight input in each value box's header when the placeholder has 2+ values, so that I can tune Wildcard odds without leaving the multiline view.
8. As a world author, I want each box to show its resulting roll chance next to the weight, so that I can see the effect of a weight change immediately.
9. As a world author, I want a delete button on each value box, so that I can remove a value in place.
10. As a world author, I want an Add Value button under the boxes, so that I can append a new value without switching views.
11. As a world author, I want each value card to collapse to a one-line summary of its first line, so that a placeholder with many long values stays scannable.
12. As a world author, I want the weight, chance, and delete controls to stay usable on a collapsed card, so that I can tune odds without expanding everything.
13. As a world author, I want a collapse-all / expand-all control in the values header row, so that I can get a long list into a known state in one click.
14. As a world author, I want a multiline value shown in the chip view as its first line plus an ellipsis, so that flipping back to chips never wraps a paragraph into a giant chip.
15. As a world author, I want clicking a chip to keep opening the draw-weight pop-out exactly as today, so that nothing I already know changes.
16. As a world author, I want switching between the two views to never alter my values, so that the toggle is purely a change of lens.
17. As a world author, I want my per-value draw weights to survive edits, renames, and deletions made in the multiline view, so that tuning I did earlier is not silently lost.
18. As a world author, I want leading/trailing whitespace trimmed when a multiline value commits, but internal blank lines kept, so that my markdown structure survives while values stay cleanly comparable.
19. As a world author, I want a value that trims to empty to be removed, so that both views agree on what an empty value means.
20. As a world author, I want the same two-style editing in the entity and dictionary library editors' placeholder panels, so that every place I edit placeholders behaves the same.
21. As a world author, I want in-text placeholder chip tooltips, read-only pills, and library card descriptions to show a multiline value flattened to its first line plus an ellipsis, so that one-line UI surfaces stay one line.
22. As a world author, I want a multiline value to resolve verbatim into prompts and narration, newlines included, so that the content I wrote is what the AI and player see.
23. As a world author, I want exported worlds carrying multiline values to be plain JSON with escaped newlines and no new fields, so that sharing and importing keep working unchanged.
24. As a player, I want gameplay behavior of placeholders (Variable / Wildcard resolution, World vs Unique rolls) unchanged, so that authored worlds play exactly as before.

## Implementation Decisions

- **Toggle scope and control.** The toggle is per placeholder, rendered in the values header row of the placeholder manager as a small two-item segmented ToggleGroup (Chips | Multiline), matching the editor's existing small-toggle styling, with the guard that re-clicking the active item cannot clear it. It applies wherever the placeholder manager mounts: World Editor tab and both library editors (entity, dictionary).
- **No persistence of the mode.** No stored flag anywhere — not in the world JSON, not in localStorage. On open, a placeholder auto-detects: any value containing `\n` → multiline; otherwise chips. The toggle changes the view for the session only.
- **Multiline view structure** (from the prototype, winning variant "A — stacked cards + collapse"): one bordered card per value. Card header row: collapse chevron + "Value N" label (clickable to toggle), and on the right a weight input + roll-chance % (only when 2+ values) and a delete icon button. Card body: the markdown edit box. A collapsed card shows the value's first line + ellipsis in the header, controls still live. Below the cards, a full-width Add Value button. A collapse-all/expand-all icon button sits in the values header row (multiline mode, 2+ values only), flipping icon and label by whether anything is open.
- **The edit box is the existing markdown prompt-field machinery** — same formatting toolbar, Edit/Preview tabs, and markdown preview renderer the readme fields use — with **no placeholder-chip vocabulary**: placeholder values are literal text because resolution is single-pass, matching the existing rule that the chip palette is suppressed for values.
- **Weights survive edits.** Weights are keyed by value string; every value-list change from the multiline view goes through the same weight-remap step the chip editor uses (same-length change inherits by slot, otherwise weights follow their value). Weight semantics (1 = default and omitted, 0 = benched, relative odds) unchanged.
- **List operations.** Add and remove only in multiline view; reorder remains a chip-view affordance (order is cosmetic — Variables have one value, Wildcards pick randomly).
- **Whitespace.** Commit trims leading/trailing whitespace only, preserving internal newlines; a value that trims to empty is removed. This keeps the exact-string invariants (weight keys, import dedup) shared with the chip paths.
- **Chip view with multiline values.** Chips render a multiline value as its first line + ellipsis; editing affordances are unchanged, and clicking a chip still opens the draw-weight pop-out. Summaries show the raw first line (markdown syntax visible) — this is an authoring surface.
- **One-line display surfaces.** The shared value-summary helper flattens a multiline value to first line + ellipsis; this covers the in-text chip tooltip, read-only pills, and library card descriptions.
- **No data-model change.** `values` stays `string[]`; nothing new serializes. Exported world JSON shape is unchanged (JSON escapes newlines). No version bump, no migration.
- **Runtime untouched.** Resolution inserts values verbatim via a replacer (no regex hazards on newlines); nothing in the token grammar or single-pass rule changes.

## Testing Decisions

- Good tests assert **external behavior at the manager seam**: render the placeholder manager inside its scoped placeholder store and assert what an author sees and what the store receives — never internal component state.
- **Primary seam: the placeholder manager component** (new test file; prior art: the dictionary manager's component tests). Cover: auto-detect on open (newline → multiline, none → chips); toggling views does not alter values; typing a multiline value stores it with newlines, outer whitespace trimmed; a value trimmed to empty is removed; weight edited in a box header lands in the store and survives a text edit of the same value (remap behavior); add and delete boxes; collapse/expand per card and collapse-all/expand-all, with controls usable while collapsed; weight/chance controls only appearing at 2+ values.
- **Secondary seams, both existing suites:** the pure placeholder-summary tests gain cases for first-line + ellipsis flattening; the keyword-chips tests gain cases for truncated display of a value containing newlines.
- jsdom gotchas already cataloged for this repo apply (Radix portals, Lexical editors in tests) — follow the existing manager tests' setup rather than inventing new stubs.
- UI verification in the live preview via the dev-router (`worldEditor` + placeholders tab), static DOM evidence, both themes if colors are touched.

## Out of Scope

- Persisting the chosen editor mode anywhere (world JSON, localStorage).
- Reordering values in the multiline view (drag or buttons).
- A popover/inline multiline editor reachable from the chip view.
- Placeholder chips inside placeholder values (nested resolution stays unsupported by design).
- Stripping markdown syntax from summaries, or protecting name fields from multiline values — authors own those choices.
- Any change to resolution, token grammar, weights semantics, or export shape.
- WYSIWYG/rich markdown editing beyond the existing toolbar + preview.

## Further Notes

- A throwaway prototype (three layout variants behind `?variant=` in dev builds) settled the layout: variant A (stacked cards) plus independent per-card collapse and a header collapse-all. The prototype lives on the working tree at the time of writing and must be parked on a throwaway branch, not merged — the winning layout gets rewritten properly, with real store writes, in the placeholder manager.
- The prototype confirmed the markdown prompt-field renders and previews correctly when embedded per-value, and that its chrome is fairly tall — the card layout absorbs this; no new compact editor is warranted.
- The existing "eye" roll-chance reveal in the values header applies to the chip view; the multiline view shows chances inline per box, so the eye can stay chip-only.
