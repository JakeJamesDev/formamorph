# 01: Script Shape And Migration

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: the shape every later ticket builds on, and a load-time rewrite of a shipped field with a wide reader set.

## What to build

A script is one object with an id, an optional name, a timing, its code and an optional order (spec: Surface). Stats, traits and the world each carry a `scripts` list. On load, a stat's two shipped boxes become two scripts with timings `before` and `after`; export writes the list only (Q19, R1). The turn runner reads each timing's scripts by `order`, then today's owner-then-stat order for scripts without one (Q5). The readers that today name a box, such as Find All Uses, the template library, the Test Bench and the hover cards, read the list through one collector. A trait's or the world's list exists in the shape but no editor writes one yet. Nothing a player sees changes.

Spec: R1, R2, Q5, Q19, Q29, stories 11, 12.

## Acceptance criteria

- [ ] A world with `beforeCode` and `code` loads as scripts with the right timings and runs the same values as before; a guard test runs a shipped bundled world through both paths and compares every stat
- [ ] Export writes `scripts` and never the two old fields; the import boundaries, the card reader and the library store all migrate
- [ ] Within a timing, scripts with `order` run ascending before scripts without one, and the later write wins a field; a test proves a world script ordered after a stat script wins a shared write, and loses with the orders flipped (Q30)
- [ ] Every reader that named a box reads the list: Find All Uses rows, template insert targets, Test Bench findings, hover cards
- [ ] Four gates green

## Blocked by

- None (can start immediately)
