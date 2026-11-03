# 12: Currencies in Test Code and Tools

Status: done
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

- [x] A script using `currencies.X.balance` and `pay` runs in Test Code and in the Test Bench, through the real paths, and shows its result. `WorldEditor.scriptSurfaces` "Test Code on a world with an Items Currency", and a DOM read of the box on Emberwatch. The Bench reports only a failing script: `statCodeTestRun.currencies` "settles a real pay under a persona lens".
- [x] A Test Code or Test Bench pay changes no save or world state. World deep-equal after each run, in `statCodeTestRun.currencies` and `WorldEditor.scriptSurfaces`.
- [x] A user Tool reads a balance, including an untracked owner's null. Calling `pay` from a Tool stops with an error. A test fails when `pay` reaches a Tool. `statCodeTestRun.currencies` "a user Tool", with the prelude and the host guard each reinstated as a bug.
- [x] The stat code sandbox exposes nothing else new. `statCodeSurface.access` and `toolScriptSurface` hold out `discover`, `owner` and `self`. The existing `items` global now fills in Test Code, the Bench and editor Tool runs, because money reads it.
- [x] Completions, Code Hover Cards and the scripting docs say what a Tool can do with `currencies`. `codeCards.currencies`, `toolScriptMenu`, `docs/Scripts-Reference.md`, `docs/Tools.md`. `currencies.X.` has no member completions on any surface, as with `items.X.`, so the global's text carries the rule.
- [x] A changelog fragment exists only if a released surface changed. None: Currencies are still unreleased.

For you: run a toll script in Test Code on a world with an Items Currency. Does the result read clearly?

## Landed

**Not verified**

- Nothing unticked.

**For you**

- For you: run a toll script in Test Code on a world with an Items Currency. Does the result read clearly? On Emberwatch the box reads `currencies.Coin.pay: 1 Silver from persona to Jory Pike · currencies.Coin.pay: 2 Gold to Jory Pike`.

**Known limits, for the spec session**

- A world that places money on the player directly, as Emberwatch does, settles a pay from a blank `persona` in Test Code. The refusal shows only when the plan fails.
- Under a blank `persona`, a Global Stat wallet reads its value and pays (Q21). Items income to a blank `persona` settles.
- A script that throws loses its pay lines, like every other write of a failed run.
- A `pay` called through an alias, `const c = currencies.Coin`, has no editor mark. The run still stops.
- Formaquestion's in-game code test reads the Player View world, which has no Currencies.
