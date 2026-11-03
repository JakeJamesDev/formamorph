# 08: Played Persona Row Order

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

The close's review confirmed this with a probe: a run read 21 where 12 was expected.

## What to build

A played world persona with no stats runs first in a Blueprint trait row, even when it is authored last. Owners in a row run in authored owner order, with no played-first step, so a world's order doesn't change with who plays.

Rulings: Q21, Q22.

## Acceptance criteria

- [ ] A test through `runStatCodeTurn`, with the tab's row order, proves a played persona with no stats runs in authored owner order in a Blueprint trait row.
- [ ] A test proves the same order for that persona's own trait rows and its stat rows.
- [ ] The guard fails when the played persona runs first again.
- [ ] The `worldScriptEntries` comment and the owner-order comment in the turn runner no longer describe a played-first order.
