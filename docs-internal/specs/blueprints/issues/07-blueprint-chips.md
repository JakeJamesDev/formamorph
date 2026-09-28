# 07: Blueprint chips

Status: ready-for-human
Base: 0111d245
Blocked by: 04 — Placeholder Blueprints group and copy rows
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high
Rationale: one predicate wired into six insert paths, a resolver change that threads the bearer context, a Preview rule and a new chip glyph behind a design gate.

Parent: [Blueprints spec](../spec.md)

## What to build

An author places a blueprint placeholder as a chip in the text of any original trait, at root or under Blueprints, and in blueprint and copy values. Every other field refuses it: the `{` typeahead does not offer it, and paste, palette drag, search and replace, and card, lorebook and dictionary import drop it with the existing refusal notice. One predicate decides every path.

A blueprint chip shows the link glyph. That is a new visual pattern: add a design-system showcase entry and get the user's approval before adoption.

In trait text the chip resolves to the bearer's copy through the copy lookup and the bearer context. Nested blueprint chips resolve on the same bearer. Under None with no Custom Persona entity the chip reads the blueprint itself. An original's Preview and Values tabs read the blueprint's own values. The Test Bench lens resolves the chip for the bearer it checks.

## Acceptance criteria

- [ ] Field-predicate tests prove every insert path refuses a blueprint chip in a normal field and accepts it in the three allowed places.
- [ ] Resolver tests cover a blueprint chip in trait text per bearer, nested chips, and None reading the blueprint.
- [ ] Preview on an original reads the blueprint; the lens reads the checked bearer's copy.
- [ ] The glyph has a showcase entry and the user's approval recorded in the ticket before it ships.
- [ ] Each guard is proven to fail with its rule removed.

## Design approval

- 2026-09-28: the user approved the Link2 glyph on blueprint chips (fields, the `{` menu and the palette strip), shown in the Design System's Prompt Chips → Blueprint Chips card.
