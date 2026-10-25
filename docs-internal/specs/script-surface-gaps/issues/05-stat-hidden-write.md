# 05: Stat Hidden Write

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Opus at medium: a new writable stat field through the existing write path, plus the panel's delta chips for a stat unhidden mid-turn.

## What to build

A script writes `hidden` on any stat a `value` write reaches: its own, a global one, or an owner's (Q4, Q10). The write lands with the other stat field writes, after the run, in call order across one Timing's scripts (Q16). A During AI Output write lands with the After the AI batch (Q23). The saved stat record already carries `hidden`, so the save gains no field, and undo rewinds the write. A stat unhidden this turn appears in the panel with this turn's delta chips and no built-in notice (Q20, Q34). User Tools stay read-only. Cards, the Variable menu and the Scripts guide mark `hidden` writable.

Spec: Q4, Q10, Q16, Q20, Q23, Q34, stories 20–25.

## Acceptance criteria

- [x] A Before the AI write `stats.Rage.hidden = false` shows the stat in the panel when the turn lands, with this turn's delta chips: `statCodeTurn.hiddenWrite.test.ts` "shows a stat a Before the AI script unhides"; `GamePanels.hiddenWrite.test.tsx` "shows a stat unhidden this turn with this turn’s change chips"
- [x] `self.hidden = true` hides the stat; its deltas and trait-card lines hide with it: turn test "hides the stat its own script writes self.hidden on"; panel test "takes a stat a script hides off the panel, with its change chips". Trait-card lines: the Traits tab reads the live `globalStats` (`GamePanels.tsx:1524`) and its existing hidden-stat filter test covers the filter
- [x] An entity stat and a global stat take the write from a stat's script, as a `value` write does: "takes the write on an entity stat and on a global stat from a stat’s script"; executor "writes hidden on a global stat and on an entity stat"
- [x] A During AI Output write lands with the After the AI batch, before the After the AI scripts run: "lands a During AI Output write with the After batch, before the After scripts run (Q23)"
- [x] Undo after the turn restores the stat's earlier `hidden`: panel test "restores the earlier hidden when a rollback loads the turn before the reveal" (`loadGameState` with `keepLiveHistory`, the rollback path)
- [x] A user Tool's write lists as a dropped write: executor "lists a hidden write as read-only in a user Tool" (`runToolScript` `dropped`)
- [x] Hover cards and the Variable menu show `hidden` as writable; the Scripts guide covers it: `codeCards.test.ts` every route, `codeSurface.copy.test.ts` Variable menu leaf; ScriptsGuide "Hiding and Showing a Stat" and the quick reference (held by `statCodeQuickReference.test.ts`)

## Blocked by

- None (can start immediately)

## Landed

Rulings applied: Q45 (`previous.hidden` read-only; `hidden` reads back in the run; a non-boolean fails as a bad write) and Q46 (a World Tool's `hidden` write replays on a stats re-roll).

⚠️ Save shape: the saved trigger-write row (`SavedScriptWrites.stats[].writes[]`) gains an optional `hidden` boolean. Additive, per Q46.

**Not verified**

- Nothing in the criteria. No live play-through in the preview: every criterion is held by a unit or component test.

**For you**

- Play a turn in a world with a hidden stat and a Before the AI script that sets `stats.<Stat>.hidden = false`. Confirm the stat appears in the panel with its change chip and no extra message.
- Read the new Scripts guide section "Hiding and Showing a Stat" (`docs/ScriptsGuide.md`) for tone.
