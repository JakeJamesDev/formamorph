# 02: Lazy Entities And Placeholders

Status: ready-for-human
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: xhigh

## What to build

A Script that reads only `self` or `owner` stops paying for the rest of the cast and the placeholder tree. Each `entities` entry (with `persona` and `owner`) and each placeholder owner node loads on its first read through the host-read hook, with the host building its data only then (Q1, Q3). Names stay in the program, so `in`, listing order and the blank entry for an unknown name work without a load. A listing loads the map's remaining entries in one host call (Q6). Each write reader reports only loaded entries, with the same result as today.

This ticket owns the lazy-map primitive and the per-entry host slot; ticket 03 reuses both.

## Acceptance criteria

- [x] The parity suite from 01 passes unchanged. 31/31, file untouched.
- [x] With `countingSandbox`, a self-only Script makes no host-read call for entities or placeholders; reading one entity's field makes one; reading it again makes none; `Object.keys(entities)` makes one. `statCodeExecutor.lazyEntries.test.ts`, "an entry costs nothing until read", "an entity entry", "a listing".
- [x] Reading `owner.placeholders` loads only the owner's node, shown by a host-read count that does not grow with the number of other entities' placeholder nodes. "loads only the owner’s node …": 2 reads with 6 residents and with 24.
- [x] A read-only Tool run reads entities through its view without loading entries it never reads (host-read count). "a read-only Tool run" cases.
- [x] Reverting to eager loading fails the host-read tests; record the check. See Landed.
- [x] Bench "after" numbers for this ticket in the Landed section, next to 01's "before" row. See Landed.
- [x] Changelog fragment written: Scripts run faster on worlds with many entities and placeholders. `docs-internal/changelog.d/lazy-world-entries-02.md`.

For you: none.

## Landed

- **Shape:** each `entities` entry (and an unnamed persona, and an owner entry of its own) is a frozen shell made at prelude time. Its first field read fills it from its host slot, built only then (Q3). The map keeps its shells, so `in`, `typeof`, identity and key order need no load. A listing fills the rest in one call that carries only unsent entries (Q6). Each placeholder root, top key (Q15) or owner node, loads its subtree on first touch. `owner.stats` reads without a load (Q16).
- **Primitives for 03:** `lazyEntrySlots` (host), `LAZY_ENTRY`, `LAZY_MAP` and `READ_ONLY_ENTRY_MAP`'s `lazy` option (VM), bound once as `ENTRY_MAP`.
- **Reader order:** each shell reserves its stat-reader row and its empty-owner scan row when made, and placeholder rows and sites go by node index. "writes through entries loaded out of order" passes on this code and on the eager code at 95a93072b.
- **Test changes (Q18):** `statCodeExecutor.heavyText.test.ts` "never for a run that reads no heavy field" is now "only to load entries for a run that reads no heavy field", expecting 2 calls; "once for a field read twice" expects 3. `tools/toolSnapshot.heavyText.test.ts` "asks the host once per text it reads, and never for one it does not" is now "… and for no text it does not", expecting 1 call for the listing, then resets before the text case. Each has a one-line comment.
- **Eager check:** filling every entity at prelude time (`fillAll()` after the map is built) failed 8 lazyEntries cases. Loading every placeholder root at prelude time failed all 14 then present. Dropping the scan reservation, and pushing stat readers at fill instead of at creation, each failed "writes through entries loaded out of order". Source restored each time; parity stayed green throughout.
- **Q17:** an item event with an entity `from` or `to` arg still lists `entities` in the items prelude, which loads every entity in one call. Left for ticket 03.
- **Prelude:** the no-world program grew 2.1 KB (52.2 → 54.3 KB).

| `npm run bench:lazy-world`, median of 41 | ms | × no world | program |
|---|---|---|---|
| **Before** (01, eager, a377e4f9a) self only / owner.placeholders / full world | 34.76 / 35.37 / 34.81 | 6.06 / 6.16 / 6.06 | 254.6–254.7 KB |
| **Eager at 95a93072b**, same window as after | 47.92 / 47.88 / 47.93 | 7.15 / 7.14 / 7.15 | 259.1 KB |
| **After** (this ticket), no world 5.05 ms | 12.73 / 14.13 / 27.58 | 2.52 / 2.80 / 5.46 | 91.7 / 93.9 / 91.7 KB |

Measured 2026-11-17 on a loaded machine, so compare ratios within one row pair. The 91.7 KB left in a self-only program is items, locations and books, which ticket 03 makes lazy.

**Not verified:**
- That a listing sends only unsent entries is checked by reading the code, not by a test: `hostCalls` records hook names, not payloads.
- A script that replaces built-ins such as `Object.defineProperty` before its first entry read: entries now build during the run, so some build steps use the replaced global. No world is known to do this.

**For you:** none.
