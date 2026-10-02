# 06: Breadcrumb Picker in the Design System

Status: ready-for-human
Base: 3a36f880
Blocked by: 01, 03
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Parent: [Breadcrumb Picker spec](../spec.md)

## What to build

The Design System documents the **Breadcrumb Picker** as a pattern, with a live showcase entry (Q10, Q11).

- A pattern section: purpose, composition, row layout and collapse rule, states (default, picked, disabled, empty, no matches), keyboard behavior, responsive behavior, and production mapping.
- The Q11 rule: lists of world content use the Breadcrumb Picker. Short fixed option sets keep Select.
- One line that tells it apart from Searchable Group Picker. That one is a Dialog for an unbounded destination list with create. This one is a popover form control.
- Update the Code Template Selection and Detail pattern so its parameter form names the Breadcrumb Picker.
- A showcase entry with a fixture tree: deep paths, a long name, a shared persona trait, an empty slot and a no-match search. Add its dev-route entry.

## Acceptance criteria

- [x] The showcase entry opens from its dev route and renders every listed state with production components.
- [x] The copy passes a copy sweep (Writing Guide roles, STE for non-creative text).
- [x] verify-ui frames of the showcase in both themes.
- [x] The four gates are green.

## Notes from ticket 03

- The Code Templates reference in the Design System has sample traits, entities and a "Trait Bonus" template. Build the showcase fixture on it.
