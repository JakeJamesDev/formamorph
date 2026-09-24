# 04: Test Bench and stat request read the module

Status: ready-for-human
Base: 62982835
Blocked by: 01 — Chip Values module with the authored adapter
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Workload: two mechanical consumer swaps with existing tests on both sides. The Test Bench instrument keeps its block table and its token estimates; only the value source changes. The stat request drops a copied enumeration block.

## Parent

[Spec: Chip Values](../spec.md)

## What to build

An author opens the Test Bench's AI-context instrument and sees each block, "Entities Here", "Sub-Locations", "Stats" and the rest, carrying exactly the value the matching chip would carry in a prompt, because the instrument now reads the module's output keyed by its own block-to-token table. Its own token decoders go. The stat-request builder, which renders the Stats chip for the stat-update pass, drops its copied Stats enumeration and reads the module's Stats values. After this ticket no token decoder exists outside the module.

## Acceptance criteria

- [ ] The AI-context instrument builds a Chip Scene through the authored adapter and reads each block's value from the module's output by the block's token
- [ ] The instrument's token estimates, rosters and destinations render as before; its own selection, format and stat-argument decoders are deleted
- [ ] The stat-request builder reads its Stats token values from the module and its copied enumeration block is deleted
- [ ] The Test Bench AI-context tests and the stat-request tests pass without edits
- [ ] A repository search finds no remaining hand-typed content or format axis id outside the registry and the module
- [ ] Four gates green; `graphify update .` run; changelog entry under In Progress, 🛠️ Developer tooling, grouped with ticket 01's entry

## Blocked by

- 01 — Chip Values module with the authored adapter
