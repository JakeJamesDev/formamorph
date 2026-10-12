# 05: Dice Roll Template

Status: done
Blocked by: 02
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

One new built-in template with slots, plus its test beside the existing template tests. Sonnet at medium effort.

## What to build

A new After the AI template, Dice Roll With Consequences. It rolls a d20, pins the band text to a placeholder slot, halves one target stat's value on a 1, adds one to another target stat's value on a 20, and returns the roll as the stat's own value. Slots: the two target stats and the placeholder. Generic names only, so a small model has nothing to parrot. A short comment names the stat-order rule for two boxes that write one field.

## Acceptance criteria

- [ ] The template appears in the After the AI menu with its slots
- [ ] Filled with two stats and a placeholder, it runs clean under the executor and writes both targets on the matching rolls
- [ ] Slot names humanize as the other templates' do
- [ ] The templates seam covers the new entry
- [ ] Changelog fragment written; four gates green

## Blocked by

- 02 (Code Writes Another Stat)
