# 02: Stat Code Reads The Turn And Writes Its Value

Status: ready-for-human
Base: 06c3a0f4
Blocked by: 01
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: high

The tracer bullet. It extracts the per-turn run seam, changes the sandbox contract, and rewires three call paths in the game view (forward turn, re-roll, clock-only run). Getting the seam shape right decides every later ticket, so this wants the strongest model.

## What to build

Stat code runs through one per-turn function that takes plain inputs and returns plain outputs. Inputs: the enabled stats with their pre-turn value and max, this turn's AI asks (value and max, raw, before flags and clamping), the regen applied per stat, and the clock. Output: the stats with code writes applied, plus which stats moved. The forward turn, the re-roll, and the clock-only run all call it; the clock-only run passes zero asks.

Inside the sandbox an author reads `self`, the same entry that sits in `stats`. Every entry now carries `previous` (value and max at the start of the turn), `requested` (the AI's asked value and max change), and `regenApplied`. Writing `self.value` sets the value; a bare number return still sets it too. `undefined` or no return applies what was written. Any other return is the existing non-number failure. The host diffs `self` out of the VM against what it injected; an untouched field keeps the pipeline's result. A failing run discards every write.

Completions offer `self` and the three input fields. Diagnostics accept no-return code and flag a write to an unknown field on `self` or a write to another stat's entry. The surface list and the executor stay bound by the drift guard.

Demo: a stat whose code reads `self.requested.value` and halves any AI gain shows half the gain on the bar.

## Acceptance criteria

- [x] One per-turn run function carries the forward turn, the re-roll, and the clock-only run; the value-only utility it replaces is gone
- [x] `self`, `previous`, `requested`, and `regenApplied` are injected and documented in the surface list
- [x] Number return, `self.value` write, and no-return all behave as specified; another return type fails as today
- [x] A throw or timeout leaves the stat unchanged
- [x] Disabled stats stay inert and unexposed
- [x] Re-roll reproduces the same code result as the original turn
- [x] Completions and diagnostics cover the new names; unknown `self` field and other-stat write each produce a diagnostic
- [x] Existing stat code templates and default worlds run unchanged (they run with no edits; see the regen note below)
- [x] Tests at the per-turn seam cover: number return, `self.value` write, omitted field, AI ask clamped, failure discards, disabled inert, clock-only zero asks
- [x] Four gates green; graph updated

## Blocked by

- 01 — Rename Held To Acquired

## Comments

**2026-09-10: regen order (user decision).** Stat code reads each stat after this turn's AI change *and* regen. `regenApplied` is the amount that regen added. Before this ticket, code read the value before regen, and its result replaced the regen. Consequences:

- A derived stat in a bundled world (drone, rampage, valentines) now reads its sources after regen. The one-turn lag is gone, so its numbers shift a little.
- Accumulating code on a stat with nonzero regen now stacks with regen. The hint "Leave Regen at 0 — code replaces it" on the Per-Turn Change and Regen Toward Target templates is now wrong. **Ticket 07 must rewrite it.**

**Seam.** The seam is `runStatCodeTurn` in `src/lib/statCodeTurn.ts`. A number return wins over a `self.value` write. The run gate also counts max-only AI asks, because code can read `requested.max`. `SELF_WRITABLE_FIELDS` in `src/lib/statCodeSurface.ts` is the list that ticket 03 extends. The live check is `e2e/stat-code-turn.spec.ts`: forward turn, re-roll, post-regen order, and clock-only run.
