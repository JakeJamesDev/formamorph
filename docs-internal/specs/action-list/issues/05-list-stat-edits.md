# 05: List Stat Edits

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

One action kind on an existing commit path; the module and tray already exist.

## What to build

A manual edit of a global or entity stat adds a Listed Action that arrives hidden, with the Stats tab's icon. Its line carries the old and new value ("Health 40 → 60"). The player can show it so the narrator hears it. Undo restores the value and the page snapshot the edit patched.

Spec rulings: Q1, Q20, Q27.

## Acceptance criteria

- [ ] A global stat edit and an entity stat edit each add a hidden entry with the Stats tab icon.
- [ ] The entry line carries the old and new value.
- [ ] Showing the entry makes it count as told to the AI in the tray header.
- [ ] Undo restores the old value, in live state and in the page snapshot.
