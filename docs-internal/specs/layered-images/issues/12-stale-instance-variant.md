# 12: A Stale Instance Variant Falls Back to the Entity-Wide One

Status: ready-for-agent
Blocked by: none
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

Play and scripts disagree on a stale instance Variant. The spec covers this in Q31 and Q32.

- An instance setting beats the entity-wide one field by field (Q31). A setting that names an image no longer in that Layer counts as unset (Q32).
- Today play merges the instance setting over the entity-wide one first, and checks for a stale Variant after (`settingsOver` in `src/lib/mediaOverrides.ts`). So a stale instance `variant` hides a valid entity-wide `variant`, and play falls back to the Layer's rules.
- The script sandbox skips a stale value key by key, so a script reads the entity-wide Variant.
- Fix: a stale instance `variant` counts as unset before the merge, so play shows the entity-wide Variant, as a script reads it. Play and the sandbox use one rule for this, not two copies.

## Acceptance criteria

- [ ] An instance `variant` that names an image the Layer no longer holds, over a valid entity-wide `variant`: play draws the entity-wide Variant. Covered by a test.
- [ ] A script read of that Layer's `variant` returns the same image play draws. Covered by a test.
- [ ] Each test goes red with the old merge order reinstated.
- [ ] Changelog: none if Layered Images is still unreleased (fold into the existing entry only if its wording changes).
