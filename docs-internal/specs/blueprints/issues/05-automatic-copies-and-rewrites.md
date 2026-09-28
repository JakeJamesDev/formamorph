# 05: Automatic copies and rewrites

Status: ready-for-human
Base: 0111d245
Blocked by: 02 — Custom Persona as an entity mark; 04 — Placeholder Blueprints group and copy rows
Recommended model: Claude Fable 5.1 (`claude-fable-5-1`)
Reasoning effort: high
Rationale: world transforms with several triggers, nesting, a use count that spans traits and chips, and two rewrites. Correctness work where a missed trigger leaves a bearer with no copy.

Parent: [Blueprints spec](../spec.md)

## What to build

An author never makes a copy by hand. Each of these creates the bearer's copy of every blueprint the trait pins or places, and copies of every blueprint those copies' values reach: adding, linking or moving a trait onto a bearer; adding a blueprint chip or pin to an original that already has bearers; marking an entity Persona or Custom Persona while root traits pin or place blueprints. A root trait creates copies on every Persona-marked entity and on the Custom Persona entity.

A copy is in use while any trait on that bearer pins or places its blueprint, or any chip in that owner's own text points at the copy. When the last use leaves, an untouched copy is removed. An edited copy stays.

Detach, and a drag of an original onto an entity as an owned trait, rewrite every blueprint chip and blueprint pin in the trait to the entity's copy and create the copies that are missing. This settles trait-links ticket 02's open question: the cross-owner drag is a move that rewrites.

## Acceptance criteria

- [x] World-transform tests cover each trigger, nested copies, root-trait copies on every persona, and copies created on marking.
- [x] Cleanup removes only untouched copies, never while a chip in the owner's text uses one, and never an edited copy.
- [x] Detach and drag-to-entity produce an owned trait whose chips and pins name the entity's copies; missing copies are created.
- [x] Each guard is proven to fail with its rule removed.
