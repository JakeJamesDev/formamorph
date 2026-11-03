# 08: Played Persona Row Order

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

The close's review confirmed this with a probe: a run read 21 where 12 was expected.

## What to build

A played world persona with no stats runs first in a Blueprint trait row, even when it is authored last. Owners in a row run in authored owner order, with no played-first step, so a world's order doesn't change with who plays.

Rulings: Q21, Q22.

## Acceptance criteria

- [x] A test through `runStatCodeTurn`, with the tab's row order, proves a played persona with no stats runs in authored owner order in a Blueprint trait row. (`statCodeTurn.runOrder.test.ts`, "runs a Blueprint trait row in authored owner order")
- [x] A test proves the same order for that persona's own trait rows and its stat rows. (same file, two `it.each` cases, with and without row order)
- [x] The guard fails when the played persona runs first again. (Blueprint row and own-trait-row cases failed 21 vs 12 before the fix; the old played-first test in `statCodeTurn.traitScripts.test.ts` now expects authored order)
- [x] The `worldScriptEntries` comment and the owner-order comment in the turn runner no longer describe a played-first order.

## Landed

**Not verified**
- No test covers a played library persona or a Custom Persona entity in the new sort; the library's place after the list stays pinned by the existing library test.
- The stat-row cases passed before the fix too, since the caller already lists stat owners in authored order; they pin that.

**For you**
- None.
