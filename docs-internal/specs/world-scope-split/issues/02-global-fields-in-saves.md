# 02: Global Fields in Saves

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: high

Sonnet at high: a migration with snapshots and idempotence to get right.

## What to build

Saves write `globalStats` and `globalTraits` in place of `playerStats` and `playerTraits` (Q4). Cascade-off traits, switched-off traits and applied trait values use one global/owners split (Q15); `disabledTraitIds` already holds global traits only and stays. Old saves migrate at load, every snapshot included, idempotently. New saves write the new names only (Q9).

⚠️ Export-shape change: carry the reminder in the response.

Spec: Q4, Q9, Q15, stories 15–17.

## Acceptance criteria

- [ ] An old save loads with the same global stats, global traits, cascade-off, switched-off and applied values
- [ ] Every snapshot migrates; a second migration changes nothing
- [ ] A fresh save writes no `playerStats` or `playerTraits`
- [ ] A cascade-off global trait returns when its gate holds after a save round trip
- [ ] Removing a migration step fails its test
- [ ] Four gates green

## Blocked by

- None (can start immediately)
