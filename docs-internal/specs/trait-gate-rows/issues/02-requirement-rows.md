# 02: Requirement rows end to end

Status: ready-for-agent
Blocked by: none
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: one shared shape change that reaches the gate module, every requirement consumer, two codecs and the editor field; the rest of the effort builds on it.

Parent: [Trait Gate Rows spec](../spec.md)

## What to build

A trait's gate is a list of Requirement Rows. A row holds when every Condition in it holds; the trait is available when any row holds or it has no rows (Q1, Q6). An author adds a Condition to a row with **And**, adds a row with **Or Another Way**, and removes a row in one click. Every shipped world opens with one-chip rows and reads exactly as before (Q17). No Not in this ticket; the `not` flag is ticket 03.

The shape, from the prototype:

```ts
type TraitRequirementRow = { all: TraitRequirement[] };
// Trait.requires?: TraitRequirementRow[]; TraitLinkFields.requires follows.
```

## Acceptance criteria

- [ ] `Trait.requires` and the link override field are rows. `migrateWorld` wraps each flat entry in its own row on world traits, entity-owned traits and link overrides, leaves rows alone, and is idempotent (Q17).
- [ ] The character card codec reads the flat list and rows, and writes rows (Q18).
- [ ] Owned-trait import, portable traits, link id remaps, blueprints and the persona-boundary bearer drop all work per row. At the persona boundary a self-named Condition drops its whole row as closed; a trait with every row dropped is not offered, as today (Q23, ruling A).
- [ ] The gate module reads rows: a Condition holds as today, a row holds when every Condition holds, a gate holds with no rows or some row. Gate state is per row with per-Condition text, holds, unresolved and hidden flags. `settle`, `switchTrait` and `settleDefaults` behave as before for one-chip rows.
- [ ] The player line and the tree summary read rows joined by "or" and Conditions by "and" (Q11 without Not). The hidden rule applies per row (Q12).
- [ ] The Requires field renders rows: chips joined by "and" inside a bordered row, a dim "or" between rows, **And** per row, **Or Another Way** below, **Add Requirement** when there are no rows, a row remove control; removing a row's last chip removes the row (Q6). Chips still open their target and read red when unresolved. The hint line is removed (Q21).
- [ ] Test Bench's existing requirement rules keep passing on rows (the row-aware rules are ticket 04).
- [ ] Tests at the spec's seams: gate module (and, or, no rows), gate line text, `migrateWorld` twice, card round-trip and flat import, Requires field structure. Each guard is shown to bite.
- [ ] Changelog fragment in `docs-internal/changelog.d/` names the rows. Export-shape reminder in the landing message.
- [ ] Gates green: `typecheck`, `lint`, `test`, `build`.

## Comments
