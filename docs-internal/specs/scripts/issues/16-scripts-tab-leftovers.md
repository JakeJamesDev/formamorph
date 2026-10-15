# 16: Scripts Tab Leftovers

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: three small fixes across the undo reveal map, the tab rows and the code readers, each with a guard.

## What to build

Three gaps ticket 03 left in the Scripts tab.

1. **Undo returns to the tab.** Undoing an edit made on the Scripts tab reveals the script's row and box on the Scripts tab, for a world script and for a stat or trait script alike, with the field pulse the History Reveal Origin effort gives every undo. Today a world-script undo reveals nothing and a stat or trait script undo reveals the Stats or Traits tab. The reveal map has no Scripts entry, and the tab keys rows by home and script id, so the reveal needs that mapping.
2. **Disabled stats are marked.** A row for a disabled stat's script shows the same disabled marker the Stats tab uses, since the runner skips it.
3. **World scripts are first-class in the box.** In a world script's box the Variable menu labels `self` for a world script, not "This Stat". Find All Uses walks world scripts, so a rename or a use count never misses one.

Spec: Q18, Q25, Q31, Q46.

## Acceptance criteria

- [ ] Undo of a world-script edit made on the Scripts tab lands on that row and box with the pulse; the same for a stat script edited there; a test drives each
- [ ] A disabled stat's script row carries the disabled marker; enabling the stat clears it
- [ ] The Variable menu in a world script's box names `self` correctly; Find All Uses lists a stat used only by a world script
- [ ] Four gates green

## Blocked by

- None (can start immediately)
