# 02: Lazy Entities And Placeholders

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: xhigh

## What to build

A Script that reads only `self` or `owner` stops paying for the rest of the cast and the placeholder tree. Each `entities` entry (with `persona` and `owner`) and each placeholder owner node loads on its first read through the host-read hook, with the host building its data only then (Q1, Q3). Names stay in the program, so `in`, listing order and the blank entry for an unknown name work without a load. A listing loads the map's remaining entries in one host call (Q6). Each write reader reports only loaded entries, with the same result as today.

This ticket owns the lazy-map primitive and the per-entry host slot; ticket 03 reuses both.

## Acceptance criteria

- [ ] The parity suite from 01 passes unchanged.
- [ ] With `countingSandbox`, a self-only Script makes no host-read call for entities or placeholders; reading one entity's field makes one; reading it again makes none; `Object.keys(entities)` makes one.
- [ ] Reading `owner.placeholders` loads only the owner's node, shown by a host-read count that does not grow with the number of other entities' placeholder nodes.
- [ ] A read-only Tool run reads entities through its view without loading entries it never reads (host-read count).
- [ ] Reverting to eager loading fails the host-read tests; record the check.
- [ ] Bench "after" numbers for this ticket in the Landed section, next to 01's "before" row.
- [ ] Changelog fragment written: Scripts run faster on worlds with many entities and placeholders.

For you: none.
