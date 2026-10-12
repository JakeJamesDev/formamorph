# 02: Code Writes Another Stat

Status: done
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

The core of the effort: the sandbox lock, the executor's marshaling, the per-turn merge across owners, and an e2e case. Opus at high effort.

## What to build

Stat code may write another stat of the same owner through the `stats` map: `value`, `min`, `max`, and `regen`. `self` stays the same object as its map entry. `id`, `name`, `type`, `description`, `previous`, and `delta` stay read-only everywhere. `entities[x].stats` and `persona.stats` keep their read-only lock and dropped-write report.

The executor marshals every entry's written fields back out, not only `self`, and diffs each against what it injected. The result lists one write per written entry: target stat id and each written field's number. A failure discards every write from the run.

The per-turn run collects writes keyed by target id. For one field, the last writer wins: stat order within the owner, then owner order. Values clamp to the target's effective range after its bounds write. Bounds writes book ledger entries as ticket 01 defines. A write to an unknown stat name reaches the blank entry and is dropped and reported by path; a write to a disabled stat is dropped and reported. Each box still runs over one snapshot: a hub's write is invisible to the target's box on the same run and absent from its `delta.actual` that run. A Blueprint stat's code runs once per owner, so `stats.Name` reaches each owner's own copy. Both boxes may cross-write.

Live delta feedback folds hub moves in as self moves. No turn-log line. Rollback and re-roll carry hub writes with the turn's snapshot.

## Acceptance criteria

- [ ] A hub's `stats.Health.value = x` lands on Health, clamped to Health's range
- [ ] A hub's bound write on another stat books that stat's ledger as ticket 01 defines
- [ ] Two writers on one field land in stat order; a self write and a hub write follow the same order
- [ ] A hub write is not visible to the target's box on the same run
- [ ] A write to an unknown stat name is dropped and reported by path; a write to a disabled stat is dropped and reported
- [ ] A write through `entities[x].stats` or `persona.stats` is still dropped and reported
- [ ] An entity stat's code writes its owner's other stats through `stats`
- [ ] A Blueprint stat's write reaches each owner's own copy
- [ ] A failing hub discards all its writes; a failed turn restores the target
- [ ] The e2e stat-code spec gains a case where a hub moves another stat and the bar shows the move
- [ ] The per-turn and executor seams prove each guard by reinstating the lock once
- [ ] Changelog fragment written; four gates green

## Blocked by

- 01 (Code Bounds Become Ledgers)
