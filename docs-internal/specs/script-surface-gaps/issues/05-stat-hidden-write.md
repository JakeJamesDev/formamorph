# 05: Stat Hidden Write

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Opus at medium: a new writable stat field through the existing write path, plus the panel's delta chips for a stat unhidden mid-turn.

## What to build

A script writes `hidden` on any stat a `value` write reaches: its own, a global one, or an owner's (Q4, Q10). The write lands with the other stat field writes, after the run, in call order across one Timing's scripts (Q16). A During AI Output write lands with the After the AI batch (Q23). The saved stat record already carries `hidden`, so the save gains no field, and undo rewinds the write. A stat unhidden this turn appears in the panel with this turn's delta chips and no built-in notice (Q20, Q34). User Tools stay read-only. Cards, the Variable menu and the Scripts guide mark `hidden` writable.

Spec: Q4, Q10, Q16, Q20, Q23, Q34, stories 20–25.

## Acceptance criteria

- [ ] A Before the AI write `stats.Rage.hidden = false` shows the stat in the panel when the turn lands, with this turn's delta chips
- [ ] `self.hidden = true` hides the stat; its deltas and trait-card lines hide with it
- [ ] An entity stat and a global stat take the write from a stat's script, as a `value` write does
- [ ] A During AI Output write lands with the After the AI batch, before the After the AI scripts run
- [ ] Undo after the turn restores the stat's earlier `hidden`
- [ ] A user Tool's write lists as a dropped write
- [ ] Hover cards and the Variable menu show `hidden` as writable; the Scripts guide covers it

## Blocked by

- None (can start immediately)
