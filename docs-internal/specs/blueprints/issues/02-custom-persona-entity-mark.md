# 02: Custom Persona as an entity mark

Status: ready-for-human
Base: 8e1cdf81
Blocked by: 01 — Blueprint shape and module
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high
Rationale: replaces a system node with an entity mark across the Traits and Placeholders tabs, the entity panel and four confirmations. Dense editor wiring over a settled model.

Parent: [Blueprints spec](../spec.md)

## What to build

An author marks one entity Custom Persona. The entity keeps its own name and owns traits, links and copies like any entity. The Custom Persona system node and its + menu entry are gone. The mark is a switch on the entity's panel beside Persona and Persona-only; turning it on hides those two, since it excludes Persona and implies persona-only. At most one entity per world carries it: the switch is unavailable elsewhere while one exists. Duplicating the marked entity drops the mark on the duplicate. The marked entity stays at root and keeps the author's order; a drop into a group is refused.

In the Traits and Placeholders tabs the marked entity is always listed as a bearer, so the author can drag to it and link to it even when it holds nothing. Removing the mark keeps the entity's links, traits and copies after a confirmation that names the counts. Deleting the entity confirms and names the counts it removes.

## Acceptance criteria

- [x] The system node is removed from the + menu, the tree and the world shape; a world built with the old node in a test no longer parses (no compat). Covered by ticket 01.
- [x] The mark switch excludes and hides Persona and Persona-only; a second entity cannot take the mark while one exists.
- [x] Duplicate drops the mark; a drop into a group is refused with the existing inline notice.
- [x] Both tabs list the marked entity as a bearer even when empty.
- [x] Unmark and delete each confirm with counts of links, traits and copies; unmark keeps them, delete removes them.
- [x] Component tests cover the switch, the one-per-world rule and both confirmations; logic stays in pure modules.
- [x] The response names the export-shape change: the Custom Persona mark on the entity.
