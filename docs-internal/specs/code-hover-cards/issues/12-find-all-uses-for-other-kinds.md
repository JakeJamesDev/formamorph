# 12: Find All Uses For Other Kinds

Status: done
Blocked by: 07, 11
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Extends 11 to four more kinds. Opus at medium.

## What to build

Find All Uses works on traits, placeholders, entities and dictionaries too, matching the item rather than its name. Every card with Open has Find All Uses.

Spec: Q22, T11-1..4; Implementation Decisions: Find All Uses.

Handoff from ticket 11: navigation lives in `CodeCardNavigationContext` (`open`, `goToUse`), and `canFindUses()` in the code-cards module is the one gate to widen for the other kinds.

## Acceptance criteria

- [ ] Find All Uses lists uses for each of the four kinds, matched by item
- [ ] Changelog fragment; four gates green

## Blocked by

- 07
- 11
