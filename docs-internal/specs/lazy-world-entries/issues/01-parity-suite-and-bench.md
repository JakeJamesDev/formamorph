# 01: Parity Suite And Bench

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

The proof and the measuring stick for the effort, before any behavior changes. No change to `executeStatCode` itself.

- A parity suite that runs a table of Scripts through `executeStatCode` over one world rich in every map, and pins each result (spec, Testing Decisions, Q5). It covers reads of every map, writes through every writable path an entry reaches, read-only writes, unknown names, listings and their order, `in` checks, identity checks (`entities.X === entities.X`, `owner` and `persona` against their `entities` entry), cross-map reads (an entity's `items`, `body` and `placeholders`; a location's cast and items; a currency's party), an item event run, a read-only Tool run and an async `player` run.
- The tracked bench script (Q7): a synthetic world of about 200 KB of entry data, printing the median per-run cost of no world, a self-only Script, an owner-scoped Script reading `owner.placeholders`, and a full-world Script that lists every map. Not in the gates.

## Acceptance criteria

- [x] The parity suite is green at the spec's base commit, run in a detached worktree of that commit (record the sha in the Landed section). Run in the ticket worktree at a377e4f9a (Q12); see Landed.
- [x] Each parity case asserts the whole `executeStatCode` result, so a changed write row, read-only note or error fails it. Inline snapshots of the whole result; error stacks are cut, the message and `kind` stay.
- [x] Breaking one write reader on purpose (a dropped row) fails at least one parity case; record which. See Landed.
- [x] The bench runs from one documented command and prints the four medians; its numbers on today's code go in the Landed section as the "before" row. `npm run bench:lazy-world`.
- [x] The bench world's entry data measures about 200 KB in the program text (state the measured size). 206.6 KB.

For you: none.

## Landed

- **Suite:** `src/lib/statCodeExecutor.parity.test.ts`, 31 cases, green at a377e4f9a in the ticket worktree. `git diff a377e4f9a --stat -- src` showed only `src/lib/statCodeExecutor.parity.test.ts`, so the executor under test was the base commit's.
- **Re-pin (Q14):** 05cc53b4a "Add Script Media Overrides" landed during prepare and added `image`, `sound`, `instances` and `ambience` to entries. 7 pins failed only on those added fields; no existing value changed. Re-pinned and green on the eager code rebased onto dae6ec050; `git diff dae6ec050 --stat -- src` showed only `src/lib/statCodeExecutor.parity.test.ts`.
- **Error pins:** each pin keeps the error message and `kind` and cuts the stack, whose line numbers count program text, not Script-visible behavior.
- **Mutation:** dropping the first row in `readEntityWrites` (`readEntryWriteRows(dump).slice(1)`) failed 4 cases: "drops writes through unknown names and reports them", "switches traits through entities, persona and owner", "reports writes to read-only fields of every map", "reads entries around a player.ask on the async engine". Source restored, diff empty.
- **Bench:** `npm run bench:lazy-world` (`scripts/lazyWorldBench.ts`). It times `executeStatCode` end to end. Its "world data" line is the full-world program minus the no-world program, so it means world size only on eager code.

| Before (eager, a377e4f9a), median of 41 | ms | × no world | program |
|---|---|---|---|
| no world | 5.74 | 1.00 | 48.1 KB |
| self only | 34.76 | 6.06 | 254.6 KB |
| owner.placeholders | 35.37 | 6.16 | 254.7 KB |
| full world | 34.81 | 6.06 | 254.7 KB |

Measured on 2026-11-16 with other sessions' processes running, so absolute times read high; compare ratios.

**Not verified:** none.

**For you:** none.
