# 03: Stat Code Sets Its Own Bounds

Status: ready-for-agent
Blocked by: 02
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: high

Touches the effective-bounds derivation, the player stat shape, save loading, and the stat bar. The override step must survive a trait toggle and the AI max delta must keep accumulating underneath, which is subtle enough to want Opus.

## What to build

Writing `self.min`, `self.max`, or `self.regen` sets that bound for the stat. The written number is absolute and final for that field. It is stored on the player stat as a code bound beside the base fields and the AI max delta. Effective-bounds derivation gains a last step: a code bound, when present, replaces the derived result for its field. Max stays floored at effective min; value stays clamped to the effective range. A code write to `value` in the same run applies after the bounds write and clamps to the new range.

A code bound persists until the stat's code next runs. Empty code clears every code bound on that stat, and the AI max delta accumulated underneath then shows through. A trait toggled mid-game re-derives bounds and the code bound still wins.

A save without code bounds loads as before. A code bounds change shows on the bar as a range change, not a delta. Test Code lists every bound the run wrote beside the value. Completions offer the writable fields.

This ticket changes the save envelope shape (additive, optional fields on each player stat). Say so in the closing response so the user can make the version call.

## Acceptance criteria

- [ ] `self.min`, `self.max`, `self.regen` writes land as code bounds and show as the stat's effective bounds
- [ ] A trait toggle after a code bound write does not wipe the code bound
- [ ] Empty code clears the stat's code bounds; the derived cap including the AI max delta returns
- [ ] A value write in the same run clamps to the newly written range
- [ ] A save with no code bound fields loads with none
- [ ] The stat bar shows a range change for a code bounds write; the delta text does not report it as a value delta
- [ ] Test Code shows written bounds beside the value
- [ ] Tests at the per-turn seam cover each bound write and the omitted-field rule; derivation tests cover override, trait toggle survival, and clearing; a save-load test covers the missing fields
- [ ] Closing response states the save-shape change
- [ ] Four gates green; graph updated

## Blocked by

- 02 — Stat Code Reads The Turn And Writes Its Value
