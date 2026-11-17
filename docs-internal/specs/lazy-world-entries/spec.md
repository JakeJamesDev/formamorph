# Spec: Lazy World Entries

Status: ready-for-agent
Spec session: lazy-world-entries — spec

Every Script run writes the whole Sandbox Snapshot into its own program text as JSON literals, and QuickJS parses all of it on every run, even when the Script reads only `self`. This spec makes each world entry load from the host on its first read, through the existing host-read hook (script-surface Q37, Q48), so a run pays only for what it reads.

## Problem Statement

A Script's cost grows with the size of the world, not with what the Script reads. On a large world, every Script in every Timing pays for the whole cast, every placeholder, every item and every place, on every turn.

Measured on 2026-11-16 on Sunmeadow Town (an untracked world of about 200 KB of entity data), with a spy on the sandbox runner:

| Program | Size | Run time |
|---|---|---|
| Empty runtime, no program | – | 0.31 ms |
| No world at all (the prelude code only) | 47 KB | 3.6 ms |
| Check 34 median (an owner-scoped Script) | 79 KB | 5.8 ms |
| Check 51 median (reads `owner.placeholders`) | 228 KB | 16.5 ms |

In check 51 the largest parts are placeholders (80 KB), entities (57 KB) and items (41 KB). Check 51 ran 1,384 Script runs in 27.8 s, and check 34 ran 6,935 runs in 44.1 s. A CPU profile put 60–75% of that time in the sandbox's `evalCode`.

## Solution

Each entry of a world map loads on its first read. The program carries the entry names; the host builds and sends an entry's data only when code reads that entry. A Script that reads only `self` or `owner` costs about the same on a large world as on an empty one.

Nothing a Script can observe changes: the same reads return the same values, the same writes land, the same read-only writes are reported, and the run's result is the same.

## Rulings

| Q | Ruling |
|---|---|
| Q1 | Laziness is per entry, not per section. Each entity entry (including `persona` and `owner`), each placeholder owner node, each item, each location, each dictionary book and each currency loads on its first read by name. Per section was rejected: one `owner.placeholders` read would force the whole placeholder tree (80 KB in check 51). |
| Q2 | The fixed prelude code (47 KB, 3.6 ms per run with no world) is out of scope. It gets its own effort (bytecode cache or a smaller prelude). |
| Q3 | The host also defers its own work: an entry's data is built inside the host-read hook on first read, not marshaled before the run. |
| Q4 | A lazy fetch is a host call, so the run's time budget pauses during it (script-surface Q49). No new rule. |
| Q5 | A parity suite comes first. It compares `executeStatCode` results only, is proven green on the eager code at the spec's base commit in a detached worktree, and then stays as the permanent floor every later ticket keeps green. |
| Q6 | Listing a map (`Object.keys`, `for…in`, `Object.values`, `Object.entries`, spread) loads all of that map's remaining entries in one host call. A Script that reads the whole world may be at most 10% slower than today. |
| Q7 | A tracked bench script builds a synthetic world sized like Sunmeadow (about 200 KB of entry data) and prints the per-run cost of a self-only, an owner-scoped and a full-world Script. It is not in the gates. |
| Q8 | Acceptance bar: on the bench world, a Script that reads only `self` or `owner` (with `owner.placeholders`) costs within 25% of the no-world run. |
| Q9 | One test seam: `executeStatCode`. Tests read its results and the host-call counts of `@/test/hostCalls`. No new seam below it. |
| Q11 | Parity pins are inline snapshots of the whole `executeStatCode` result, generated once on the eager code and read by hand. Later tickets never update them with `-u`; a changed pin is an intent question (ticket 01 ruling). |
| Q12 | Ticket 01's worktree at the base commit, with no `src/` change but the new test file, meets Q5's "green at base"; no separate detached checkout is needed (ticket 01 ruling). |
| Q13 | The bench gets an npm script. It times `executeStatCode` end to end, so host-side work (Q3) counts; program size is reported beside it, not used as the measure (ticket 01 ruling). |
| Q14 | When main changes the eager builder before ticket 01 lands, ticket 01 re-pins on the rebased eager code. It may do so only when every changed pin is an addition from the landed change. The Landed section records the proof at both shas. Q11's no-`-u` rule binds the tickets that change the builder (ticket 01 ruling, after shared-media-list 08 added `image`, `sound` and `instances`). |
| Q15 | World-owned placeholder rows (top-level keys of `placeholders`) load per top-level key too, in ticket 02. Q1's intent is that cost never grows with entries a Script does not read, and world-owned rows grow with the world (ticket 02 ruling). |
| Q16 | Reading `owner.stats` does not load the owner's entry, because `owner.stats` is eager. Every other `owner` field loads it (ticket 02 ruling). |
| Q17 | An item event's entity `from`/`to` lookup must not list `entities`. Ticket 03 fixes it with a host-side id lookup, because it owns the items prelude. Until then the listing loads every entity, with the same result (ticket 02 ruling). |
| Q18 | An existing test that counts host calls may change its expected count by exactly the entry loads this spec adds. Each such change gets a one-line comment, and the test keeps its own reads. Every other existing assertion stays unchanged (ticket 02 ruling, `heavyText` "asks the host" cases: 0→2 and 2→3). |
| Q19 | A lazy fill runs during user code, so it uses only built-ins the prelude captured before user code runs. A Script that replaces a global (`Object.defineProperty`, `JSON.parse`, `Object.freeze`, `Array.prototype` methods) before its first entry read gets the same result as on eager code. Ticket 03 closes this for 02's maps and its own (02 landing finding). |
| Q20 | Q19's line: fills call `Object`, `JSON`, `Reflect`, `Array.isArray`, `Proxy` and `Array.prototype` methods only through references captured before user code, and use index loops instead of array iteration or spread. Accessors a Script adds to `Object.prototype` or `Array.prototype` are out of scope. Fills prefer literals or null-prototype objects over assignment where that costs nothing. The Q19 parity case restores the originals before it returns, so the run-end readers stay outside it, and it is pinned against the eager executor at e6dbe16c6 (ticket 03 ruling). |
| Q21 | World-sized lookup tables (the items prelude's entity and location target tables, the currencies prelude's party tables) each move into one deferred host slot, read on the first verb call that needs a target. `location` (the current place) stays eager like `self`; only `locations` entries are lazy (ticket 03 ruling). |
| Q22 | The bench bars are ratios from one measuring window: owner-scoped ≤ 1.25 × no-world in the after row, and full-world after ≤ 1.10 × eager full-world (e6dbe16c6) run in the same window. This replaces "01's before row" in Q6, because machine load moves absolute times (ticket 03 ruling). |
| Q10 | The gated prelude-cost test bounds an owner-scoped Script on a large world at 2× the empty world's cost. The 25% bar is checked by the bench at landing and recorded in the ticket's Landed section. |

## User Stories

1. As a player on a large world, I want each turn's Scripts to run fast, so that the turn starts without a pause.
2. As a player, I want a Script that reads only its own stat to cost the same on a large world as on a small one, so that world size does not slow every turn.
3. As a player, I want During AI Output Scripts to stay cheap per sentence, so that narration does not stall on a large world.
4. As a player, I want my saves to load and play exactly as before, so that nothing in my playthrough changes.
5. As a world author, I want my Scripts to read `entities`, `owner`, `persona`, `placeholders`, `items`, `locations`, `dictionaries` and `currencies` exactly as before, so that I do not rewrite any Script.
6. As a world author, I want writes through a lazily loaded entry to land as before, so that `owner.traits.X.enabled = true` still switches the trait.
7. As a world author, I want a write to a read-only field of a lazily loaded entry reported as before, so that the Test Bench still shows my mistake.
8. As a world author, I want an unknown name in a map to read as the same blank entry as before, so that my guards keep working.
9. As a world author, I want `Object.keys(entities)` and `for…in` to list the same names in the same order as before, so that my loops behave the same.
10. As a world author, I want `'Mira' in entities` to answer as before without loading Mira, so that a presence check stays cheap.
11. As a world author, I want `entities.Mira === entities.Mira` to hold, so that identity comparisons keep working.
12. As a world author, I want `owner === entities[owner.name]` and `persona === entities[persona.name]` to hold as before, so that owner checks keep working.
13. As a world author, I want an entity's `items`, `body`, `stats`, `traits` and `placeholders` to read as before after a lazy load, so that cross-map reads still agree.
14. As a world author, I want a location's entities and items to read as before, so that scene Scripts still work.
15. As a world author, I want an item event's `self` and `instance` to read as before, so that item Scripts still work.
16. As a world author, I want a Tool's read-only run to read the same world and report the same dropped writes, so that my Tools keep working.
17. As a world author, I want a Script that reads the whole world to be no more than 10% slower than today, so that a full scan stays usable.
18. As a world author, I want the run's time budget to measure my code's own work, so that a large world never times out a Script because of loading.
19. As a world author, I want `globalThis`-style or computed access to the maps to work as before, so that dynamic code is not broken by a text check.
20. As a world author, I want a Script that `player.ask`s on the async engine to load entries the same way, so that prompts and lazy reads mix.
21. As a world author, I want the Test Bench and Test Code to give the same results as before, so that my checks stay trustworthy.
22. As a developer, I want a parity suite proven against the eager code, so that "behaves exactly as today" is a test, not a claim.
23. As a developer, I want a host-call count to show that an unread entry costs nothing, so that a regression to eager loading fails a test.
24. As a developer, I want a bench that prints per-run cost on a large synthetic world, so that the before/after numbers are repeatable from the repo.
25. As a developer, I want the gated cost test to catch a return to eager loading, so that the gain cannot silently disappear.

## Implementation Decisions

- **Scope.** The program builder in the stat-code executor and the preludes it assembles: entities (with `persona` and `owner`), placeholders, items, locations, dictionaries and currencies. Read-only (Tool) runs and item-event runs use the same builder and are in scope. Script results, save shape and world shape do not change.
- **Stays eager.** `stats`, `owner.stats`, `self`, world `traits`, `clock`, `turn`, options, `args`, `narration`, `trait` and the world prelude's verbs. They are small, and `self` lives in the stat maps. An item event's own item entry and its instance load eagerly, because `self` and `instance` need them.
- **Names eager, data lazy.** Each lazy map ships its entry names (and the order they list in) in the program. An entry's data loads on its first read of any field. `in`, `typeof`, key listing order and the blank entry for an unknown name behave as today without a load.
- **Same binding.** Each lazy map stays the same global binding, an object that fills on first read. Identity holds across reads (`entities.X === entities.X`, `owner === entities[owner.name]` where it holds today). A read-only view wraps the lazy map without forcing a load.
- **Host side.** The run's host reads (the existing slot table) gain one slot per lazy entry, built on first read. The host builds an entry's data inside that slot, not before the run (Q3). Text that is already lazy (descriptions, summaries, dictionary values, book entries) stays lazy inside a loaded entry.
- **Listing.** A listing read of a map (key enumeration, `Object.values`, `Object.entries`, spread, `for…in`) loads every entry of that map not yet loaded, in one host call (Q6).
- **Cross-map reads.** An entry that reads another map (an entity's `items` or `placeholders`, an item's owner, a location's cast, a currency's party) loads only the entries it reaches, never the whole map.
- **Write tracking.** Each map's write reader reports rows only for loaded entries. An entry that never loaded has no writes. The run-end readback (`ENTITY_WRITES`, `TRAIT_WRITES`, `PLACEHOLDER_WRITES`, `DICTIONARY_WRITES`, `WORLD_WRITES`, the stat-write readers and the loose read-only notes) produces the same result as today for every run.
- **Engines.** The host-read hook already runs from a getter on both the sync and the async (Asyncify) engine; lazy entries use the same hook. No engine change.
- **Budget.** A lazy fetch pauses the time budget as every host call does (Q4, script-surface Q49).
- **Bench.** A tracked script builds a synthetic world of about 200 KB of entry data (entities with placeholders, items, locations) and prints the median per-run cost for: no world, a self-only Script, an owner-scoped Script reading `owner.placeholders`, and a full-world Script listing every map. Run it before the change and after; both numbers go in the Landed section (Q7, Q8).

## Testing Decisions

- A good test calls `executeStatCode` and asserts on its result or on `hostCalls`. It never inspects the program text or the prelude's internals (Q9).
- **Parity suite (ticket 1).** A table of Scripts over one world rich in every map, each run through `executeStatCode`, with each result pinned. It covers reads of every map, writes through lazily reachable entries, read-only writes, unknown names, listings, identity checks, cross-map reads, an item event, a read-only Tool run and an async `player` run. It is proven green at the spec's base commit in a detached worktree before any change (Q5). Prior art: `e2e/library-drag-parity.spec.ts` and the parity-against-history recipe.
- **Laziness tests.** With `countingSandbox` from `@/test/hostCalls`: a Script reading only `self` makes no host-read call; reading one entity makes one; reading it twice still makes one; a listing makes one per map. Prior art: `statCodeExecutor.heavyText.test.ts`.
- **Cost test.** The prelude-cost test gains an owner-scoped case on a large world, bounded at 2× the empty world (Q10). Prior art: `statCodeExecutor.preludeCost.test.ts`.
- **Guards bite.** Each new test fails when its behavior is reverted (an eager load, a missing row in a reader).
- Existing `statCodeExecutor.*.test.ts`, `scriptSandbox.test.ts` and the sandbox snapshot tests stay green unchanged.

## Out of Scope

- The fixed prelude code cost (47 KB, 3.6 ms per run). A separate effort (Q2).
- Reusing one QuickJS runtime or context across runs.
- Making `stats`, `owner.stats` or world `traits` lazy.
- Any change to what a Script can read or write.
- The user Tool runtime beyond what the shared builder gives it.

## Further Notes

- The measuring scripts are in `.scratch/lazy-sections/` (a Vite config that spies on the sandbox runner, `measure.ts`, `measure2.ts`). The untracked Sunmeadow verify (`worlds-wip/sunmeadow-verify.ts`, checks 34 and 51) is a useful extra check, not an acceptance gate.
- The text-gate patch (drop each section the code text never names) was rejected before this spec: it misses access the text does not name, such as computed access to a map.
