# 02: Stat Code Reads The Turn And Writes Its Value

Status: ready-for-agent
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

- [ ] One per-turn run function carries the forward turn, the re-roll, and the clock-only run; the value-only utility it replaces is gone
- [ ] `self`, `previous`, `requested`, and `regenApplied` are injected and documented in the surface list
- [ ] Number return, `self.value` write, and no-return all behave as specified; another return type fails as today
- [ ] A throw or timeout leaves the stat unchanged
- [ ] Disabled stats stay inert and unexposed
- [ ] Re-roll reproduces the same code result as the original turn
- [ ] Completions and diagnostics cover the new names; unknown `self` field and other-stat write each produce a diagnostic
- [ ] Existing stat code templates and default worlds run unchanged
- [ ] Tests at the per-turn seam cover: number return, `self.value` write, omitted field, AI ask clamped, failure discards, disabled inert, clock-only zero asks
- [ ] Four gates green; graph updated

## Blocked by

- 01 — Rename Held To Acquired
