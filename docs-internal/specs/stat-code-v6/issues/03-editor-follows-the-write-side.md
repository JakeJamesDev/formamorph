# 03: Editor Follows The Write Side

Status: done
Blocked by: 02
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Diagnostics, completions, and the Test Code result area, all in the editor stack with existing tests beside them. Sonnet at medium effort.

## What to build

The "writes to another stat, write to self instead" diagnostic goes, with its tests. The unknown-stat underline covers write paths as it covers read paths, so `stats.Helth.value = 1` is underlined like a read of the same name. Completions after a stat map entry's dot offer `value`, `min`, `max`, and `regen` with the documentation they carry on `self`.

Test Code lists the box's writes to other stats beside its own value, bounds, pins, and switches: stat name, field, and the number. On an entity stat's box the targets are its owner's stats, seeded at their starting values as Entity Stats seeds them. Writes are shown, never applied to the authored world.

## Acceptance criteria

- [ ] A write to another stat through the map raises no warning, by dot, by bracket, or through a name holding the entry
- [ ] A write to an unknown stat name on the write side is underlined; a write to a known name is not
- [ ] Completions after `stats.Name.` and `stats['Name'].` list the four writable fields
- [ ] Test Code shows each write to another stat with stat name, field, and number
- [ ] Test Code on an entity stat's box lists writes to that owner's stats
- [ ] Test Code applies nothing to the authored world
- [ ] The analysis and stat panel seams prove each guard by reinstating the old warning once
- [ ] Changelog fragment written; four gates green

## Blocked by

- 02 (Code Writes Another Stat)
