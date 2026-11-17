# 03: Lazy Items, Locations, Books And Currencies

Status: ready-for-agent
Blocked by: 02
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

The remaining world maps load per entry with 02's primitive: `items` (with instances), `locations`, `dictionaries` books and `currencies` (Q1). Cross-map reads load only the entries they reach. An item event's own item entry and instance stay eager, because `self` and `instance` need them. The gated prelude-cost test gains an owner-scoped case on a large world, bounded at 2× the empty world (Q10). The effort's bar is met: an owner-scoped Script on the bench world costs within 25% of the no-world run, and a full-world Script is at most 10% slower than 01's "before" row (Q6, Q8).

## Acceptance criteria

- [ ] The parity suite from 01 passes unchanged.
- [ ] With `countingSandbox`, a self-only Script makes no host-read call for items, locations, books or currencies; one read per entry, one per listing.
- [ ] An entity's `items` read loads only the items that entity holds (host-read count).
- [ ] An item event run reads `self` and `instance` as before (parity case) and loads no other item it does not read.
- [ ] The prelude-cost test's new case passes at 2× and fails with eager loading reinstated; record the check.
- [ ] Bench in the Landed section: owner-scoped within 25% of no-world; full-world within 10% of 01's "before".
- [ ] The changelog fragment from 02 covers items, places, books and currencies too.

For you: optionally play a few turns of a large world (Sunmeadow) and check turns start without the earlier pause.
