# 08: Saves Read Stat Code From The World

Status: ready-for-human
Base: e97ba4c9
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium

A read-side refresh with a direct precedent in the trait runtime, applied at two sites in the game view. Narrow, so Sonnet at medium effort. The one sharp edge is leaving every applied number alone.

## What to build

A saved game runs the world's current stat code, not the copy frozen in the save. At the sites that assemble a turn's stats for the sandbox, the forward turn and the stats re-roll, each saved stat re-reads its authoring identity from the authored world by id: `code`, `name`, `description`, and `type`. Its applied numbers stay the save's: `value`, `min`, `max`, `regen`, `starting`, the AI max delta, code bounds, and enabled state. A stat the world no longer has keeps its saved copy whole, the same fallback an unmatched trait gets. Nothing is written to the save; the refresh is read-side only, so the envelope and the world file are untouched.

The per-turn clock gate that decides whether any stat's code reads the clock reads the refreshed code too, so a world edit that adds a clock variable takes effect on a save's next turn.

This is the seam the traits already use through their refresh function; stats get the sibling function beside it. Ticket 02's migration stays world-only because of this ticket: a save never needs its code rewritten when it does not run its own.

## Acceptance criteria

- [x] After a world edit to a stat's code, a loaded save runs the new code on its next turn and on a stats re-roll
- [x] After a world edit to a stat's name, the sandbox map keys the save's stat by the new name
- [x] The save's `value`, bounds, `starting`, AI max delta, code bounds, and enabled state are unchanged by the refresh
- [x] A stat deleted from the world runs its saved code unchanged
- [x] A world edit that adds a clock variable to a stat's code makes that save's code run every turn from the next turn on
- [x] The save envelope is byte-for-byte unchanged by a load-and-play cycle, beyond the turn's own state changes
- [x] Unit tests on the refresh function cover every criterion above; the gameplay-context save round-trip test still passes
- [x] Four gates green; graph updated

## Blocked by

- None (can start immediately)

## Comments

- 2026-09-11, at cut: ticket 04 is editing the same forward-turn and stats re-roll sites in the game view to hand the sandbox full pre-turn stats. Expect a small merge there. Check which of 01 and 04 have committed before starting, stage by name, and keep the refresh call adjacent to the pre-turn stat assembly so both edits land in the same place.
- 2026-09-11, implementation: added `refreshSavedStats` in [traitEffects.ts](../../../../src/lib/traitEffects.ts), the sibling of `refreshChosenTraits` — it re-reads `code`, `name`, `description`, and `type` from the authored world by id and keeps every other field the saved stat's own. Ticket 04 had already committed by the time this started, so `runStatCode` in [GameViewer.tsx](../../../../src/views/GameViewer.tsx) picked up its `previous` freeze cleanly; the refresh call sits right beside the pre-existing pre-turn stat assembly, and the clock gate (`anyStatUsesClock`) now runs the same refresh before checking for a clock variable. `runStatCode` is the single seam both the forward turn and the stats re-roll funnel through, so one call site covers both. `src/lib/statCodeSurface.ts`/`.test.ts` were mid-edit by ticket 01 the whole time and stayed untouched.
- 2026-09-11, code review: the spec sub-agent found the clock-gate criterion had no dedicated test — the added tests proved `refreshSavedStats` copies `code`, not that the clock gate's own predicate picks it up. Added a test asserting `usesStatClock` reads true on the refreshed code. Standards sub-agent found no hard violations; the judgement calls it raised (a long mirrored TSDoc block, a `PS` test factory alongside the existing `S`, `refreshSavedStats` called at two sites in `GameViewer.tsx`) all match established precedent in the surrounding code, so left as is.
