# 12: Currencies in Test Code and Tools

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Sandbox surface changes across two callers, where exposure has to stay narrow.

## What to build

An author tests a toll script in Test Code or the Test Bench and it runs: both build the world's Currencies, so `currencies.X` no longer stops the script there.

A user Tool can read a balance with `currencies.X.balance(owner)`. Tools stay read-only for money: `pay` isn't offered to them.

The Script Run Order effort is changing how scripts read state. If its ticket 04 is `in-progress`, tell the spec session before you edit shared sandbox code.

Rulings: Q84, Q60.

## Acceptance criteria

- [ ] A script using `currencies.X.balance` and `pay` runs in Test Code and in the Test Bench, through the real paths, and shows its result.
- [ ] A Test Code or Test Bench pay changes no save or world state.
- [ ] A user Tool reads a balance, including an untracked owner's null. Calling `pay` from a Tool stops with an error. A test fails when `pay` reaches a Tool.
- [ ] The stat code sandbox exposes nothing else new.
- [ ] Completions, Code Hover Cards and the scripting docs say what a Tool can do with `currencies`.
- [ ] A changelog fragment exists only if a released surface changed.

For you: run a toll script in Test Code on a world with an Items Currency. Does the result read clearly?
