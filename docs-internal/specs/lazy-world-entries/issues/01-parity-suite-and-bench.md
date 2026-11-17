# 01: Parity Suite And Bench

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

The proof and the measuring stick for the effort, before any behavior changes. No change to `executeStatCode` itself.

- A parity suite that runs a table of Scripts through `executeStatCode` over one world rich in every map, and pins each result (spec, Testing Decisions, Q5). It covers reads of every map, writes through every writable path an entry reaches, read-only writes, unknown names, listings and their order, `in` checks, identity checks (`entities.X === entities.X`, `owner` and `persona` against their `entities` entry), cross-map reads (an entity's `items`, `body` and `placeholders`; a location's cast and items; a currency's party), an item event run, a read-only Tool run and an async `player` run.
- The tracked bench script (Q7): a synthetic world of about 200 KB of entry data, printing the median per-run cost of no world, a self-only Script, an owner-scoped Script reading `owner.placeholders`, and a full-world Script that lists every map. Not in the gates.

## Acceptance criteria

- [ ] The parity suite is green at the spec's base commit, run in a detached worktree of that commit (record the sha in the Landed section).
- [ ] Each parity case asserts the whole `executeStatCode` result, so a changed write row, read-only note or error fails it.
- [ ] Breaking one write reader on purpose (a dropped row) fails at least one parity case; record which.
- [ ] The bench runs from one documented command and prints the four medians; its numbers on today's code go in the Landed section as the "before" row.
- [ ] The bench world's entry data measures about 200 KB in the program text (state the measured size).

For you: none.
