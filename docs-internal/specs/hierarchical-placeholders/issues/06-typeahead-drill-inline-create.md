# 06 — Typeahead drill + inline create

Status: done

Spec: `../ui-spec.md` (Typeahead decision).

## Scope

- `{` typeahead drill: `›` affordance on rows with children; ArrowRight/click drills,
  ArrowLeft backs out, filter resets per level; Enter inserts the current selection as a path
  chip (full-path label).
- "New placeholder…" bottom row, prefilled from the filter; creates a born-Wildcard placeholder
  in the world list and inserts its chip.
- Touch equivalents for drill/back.

## Done

- Keyboard-path tests (drill in, back out, insert at depth) alongside existing typeahead tests;
  inline create asserts both the inserted chip and the new world-list entry. Mutation-proven.
- Live-verified via dev-router; four gates green; changelog entry appended.
