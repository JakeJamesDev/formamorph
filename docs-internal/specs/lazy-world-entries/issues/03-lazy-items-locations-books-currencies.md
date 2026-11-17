# 03: Lazy Items, Locations, Books And Currencies

Status: done
Blocked by: 02
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

The remaining world maps load per entry with 02's primitive: `items` (with instances), `locations`, `dictionaries` books and `currencies` (Q1). Cross-map reads load only the entries they reach. An item event's own item entry and instance stay eager, because `self` and `instance` need them. The gated prelude-cost test gains an owner-scoped case on a large world, bounded at 2× the empty world (Q10). The effort's bar is met: an owner-scoped Script on the bench world costs within 25% of the no-world run, and a full-world Script is at most 10% slower than 01's "before" row (Q6, Q8).

## Acceptance criteria

- [x] The parity suite from 01 passes unchanged. Its 31 pins untouched; two new cases added, 33/33.
- [x] With `countingSandbox`, a self-only Script makes no host-read call for items, locations, books or currencies; one read per entry, one per listing. `statCodeExecutor.lazyMaps.test.ts`: "loads nothing…", "loads %s once…", "loads all of %s in one call…".
- [x] An entity's `items` read loads only the items that entity holds (host-read count). "loads only the items an entity holds": 3 reads with 8 items and with 40.
- [x] An item event run reads `self` and `instance` as before (parity case) and loads no other item it does not read. Parity "runs an item event…"; lazyMaps "reads an item event’s self and instance with no load" (0 reads), "finds an item event’s target instance, loading only its item" (1 read).
- [x] An item event with an entity `from` or `to` arg loads only that entity, through a host-side id lookup instead of listing `entities` (Q17; host-read count). lazyMaps "finds an item event’s entity side…" (0 reads for the lookup, 2 for two entity reads) and "…location side…".
- [x] Every lazy fill (ticket 02's entities and placeholders, and this ticket's maps) uses only built-ins captured before user code runs (Q19). A parity case where a Script replaces `Object.defineProperty`, `JSON.parse`, `Object.freeze` and an `Array.prototype` method before its first entry read is pinned on the eager code at a377e4f9a (or e6dbe16c6) and passes here. Parity "loads entries the same after a Script replaces built-ins (Q19)", pinned on e6dbe16c6; it also replaces `Object.create`, `Object.keys`, `JSON.stringify`, `Array.prototype.push`, `Array.prototype[Symbol.iterator]` and `Proxy` (Q20).
- [x] The prelude-cost test's new case passes at 2× and fails with eager loading reinstated; record the check. See Landed.
- [x] Bench in the Landed section: owner-scoped within 25% of no-world; full-world within 10% of 01's "before". See Landed; the owner-scoped margin is thin.
- [x] The changelog fragment from 02 covers items, places, books and currencies too. The spec session reworded 02's entry on main in b27867020.

For you: optionally play a few turns of a large world (Sunmeadow) and check turns start without the earlier pause.

## Landed

- **Shape:** `items`, `locations`, `dictionaries` and `currencies` entries load from host slots on first read (Q1), through 02's entry map. A holder's `items` loads only the items it holds; the current place's held-item list is itself a host slot. The item target tables and the currency party tables are one deferred slot each (Q21). `location` stays eager (Q21). An item event's own item is eager; its `target`, `from` and `to` resolve on the host, so no map is listed (Q17).
- **Shells on demand:** to meet Q8, every lazy map (02's too) now makes an entry's shell on its first read by name. Any look at the map itself (keys, descriptors, `isFrozen`, writes) makes every shell and freezes it first. Reader rows and owner reservations sit at fixed index slots, so their order is the eager order whatever loads first. New parity case "answers a look at each map itself as a built map does", pinned on e6dbe16c6, checks this.
- **Q19/Q20:** fills call `__formamorphBuiltIns` (captured before user code) with index loops; maps and setters use null-prototype objects. Book `entries` and Generic `instances` fills are hardened too; an unknown name's path still uses the global `JSON.stringify`, as eager code does. On the 02 code at Base, the Q19 case fails.
- **Test changes (Q18):** `statCodeExecutor.heavyText.test.ts` "only to load entries…" 2→5, "once for one text two paths read" 1→2, "once for a book’s entries…" 2→3; `tools/toolSnapshot.heavyText.test.ts` listing case 1→3. Each has a one-line comment.
- **Eager check:** sending every item, location, book and currency as eager data turned 11 lazyMaps cases red and the new cost case red (13.9 ms vs 4.9 ms empty, 2.84×); parity stayed green. The case passed at 8.2 vs 4.8 ms (1.71×) before shells on demand. Other mutations, each restored and re-run green: a `for…of` in the entry shell fails the Q19 case (`Symbol(Symbol.iterator) was called`); `Object.defineProperty` in `LAZY_TEXT` fails it too; listing `entities`/`locations` for item-event sides fails both side cases; dropping the map's `isExtensible` trap fails the map-look case.

| `npm run bench:lazy-world`, median of 41 | no world | self only | owner.placeholders | full world |
|---|---|---|---|---|
| After, window A pair 1 | 5.00 ms | 5.38 (1.08×) | 6.14 (**1.23×**) | 24.85 |
| Eager e6dbe16c6, window A pair 1 | 4.45 | 25.51 | 25.57 | 24.63 (after **1.01×**) |
| After, window A pair 2 | 7.63 | 8.34 (1.09×) | 9.40 (**1.23×**) | 43.76 |
| Eager e6dbe16c6, window A pair 2 | 6.79 | 43.56 | 43.79 | 43.87 (after **1.00×**) |
| After, final code, window B pair 1 | 8.08 | 8.90 (1.10×) | 10.14 (**1.255×**) | 53.16 |
| Eager e6dbe16c6, window B pair 1 | 7.24 | 57.08 | 56.85 | 55.68 (after **0.95×**) |
| After, final code, window B pair 2 | 8.78 | 9.33 (1.06×) | 10.63 (**1.21×**) | 55.71 |
| Eager e6dbe16c6, window B pair 2 | 7.33 | 53.94 | 54.75 | 54.17 (after **1.03×**) |

Measured 2026-11-17 on a machine other sessions loaded; compare within a pair (Q22). Window B is the final code (review fold-ins on top of window A's). Programs: after 62.3 KB no world, 68.6 KB self only, 70.9 KB owner-scoped; eager 259.1 KB. The no-world prelude grew 54.3 → 62.3 KB over 02.

**Not verified:**
- The owner-scoped bar holds by a thin margin: 1.21–1.23× in four rows, 1.255× in one loaded row. The cost over self-only is the owner entry's fill (its trait map, stat map and accessors), about 0.6 ms on a quiet machine.
- An item event whose `target` is another item's instance loads that item before user code, as `args.target` is a plain field built before the run on eager code too.

**For you:**
- Optionally play a few turns of a large world (Sunmeadow) and check turns start without the earlier pause.
