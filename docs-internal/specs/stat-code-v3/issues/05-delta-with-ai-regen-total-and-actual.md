# 05: Delta With Ai, Regen, Total, And Actual

Status: ready-for-human
Base: f8b199db
Blocked by: 04
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: medium

Many touchpoints (marshal, surface list, completions two levels down, guide, help, changelog, e2e) but no hard logic once `previous` is whole. Opus at medium effort for the breadth.

## What to build

Every stat entry, `self` included, carries a read-only `delta` with four members, each shaped `{ value, min, max, regen }`. `delta.ai` is the AI's raw ask before flags and the range; `min` and `regen` read zero until the stat request can ask for them. `delta.regen` is what regen did after the enabled gate and clamping; only `value` moves. `delta.total` is every source added up, raw. `delta.actual` is the current numbers minus `previous`, field by field, so flags and the range are already in it; a code write this run is not, since code reads its snapshot. `requested` and `regenApplied` are gone. Completions after `delta.` list the four members and after any member the four fields. The guide shows `total - actual` once, under refunding what a cap ate, and the v2 changelog entry is edited in place to the new names.

## Acceptance criteria

- [x] `delta.ai`, `delta.regen`, `delta.total`, `delta.actual` each carry `value`, `min`, `max`, `regen`
- [x] On a capped ask, `actual.value` is short of `total.value` by what the range took; `total.value === ai.value + regen.value`
- [x] `delta.actual.max` reflects an AI max change that landed; `delta.actual.min` reflects a bound a trait moved since turn start
- [x] A write to any `delta` field changes nothing; the editor underlines it
- [x] `requested` and `regenApplied` are not injected; the drift guard and surface list agree
- [x] Completions two levels down under `delta`
- [x] Guide, help, and the v2 changelog entry use the new names; the guide shows `total - actual` once
- [x] The e2e stat-code spec gains a case reading `delta.ai.value` and `previous.min` through a real turn
- [x] Four gates green; graph updated

## Blocked by

- 04 — Previous Is The Whole Stat, Frozen

## Comments

- **Built** in `14f61168`, review fold in the commit after it. The executor computes `delta` in `marshal` from `DELTA_SOURCES`, so a later source such as `delta.trait` is one list entry plus its turn input, and it lands in `total` on its own. `actual` is the marshaled numbers minus `previous`.
- **Host names kept.** `StatCodeTurn` still takes `asks` and a `regenApplied` map. Only the sandbox names changed, so GameViewer passes the same inputs.
- **Nested writes.** A write into another stat's `delta` or `previous` (`stats.Health.delta.ai.value = 1`) is flagged by ticket 01's `checkWrite` walk in `df5ce5ad`. `self.delta.*` uses the existing read-only field check.
- **Open, not in scope:** `marshalSnapshot` reads a max of `0` as `100` (`stat.max || 100`), so a max going from 0 to 20 reads `delta.actual.max = -80`. The fallback predates this ticket; `actual` is the first field that reports it.
