# Stat Code v2

Status: ready-for-agent
Status note: Tickets 01–07 cut 2026-09-10 under `issues/`. Trait reads and switches folded in; further additions go to the spec first, then to a new ticket.

## Problem Statement

A stat's Dynamic Value Calculation can do one thing: return a number, which becomes the stat's value. An author who wants a stat's maximum to grow with another stat, its regen to change with the story clock, or a placeholder to shift when a threshold is crossed has no way to express it. Traits can move bounds, but only by fixed amounts and only while toggled. The AI can move a maximum, but the author cannot react to that ask or shape it. Placeholders roll once at Enter World and stay put unless a trait, location, or stat band pins them. Randomness belongs to the resolver, never to the author.

## Solution

Stat code becomes a small script over the stat it belongs to and over the world's placeholders, instead of a function that returns one number.

- The sandbox injects `self`, the stat the code belongs to. Its `value`, `min`, `max`, and `regen` are writable. What the code writes is what the stat gets this turn.
- Each stat, `self` included, carries this turn's inputs: the pre-turn `previous` value and max, the AI's `requested` value and max change before flags and clamping, and the `regenApplied` amount. Code can clamp, scale, or refuse an AI ask.
- The sandbox injects `placeholders`, one entry per placeholder by name. Each entry has the current resolved `value`, the authored `values` list resolved to text, and a `roll()` that draws one value with the author's weights. Writing `value` pins the placeholder from code.
- The sandbox injects `traits`, one entry per authored trait by name. Each entry has `enabled` and `acquired`. Writing `enabled` switches the trait exactly as the player's checkbox does, exclusive siblings included.
- A plain `return <number>` keeps today's meaning.

## User Stories

1. As a world author, I want to set a stat's maximum from code, so that a stat's cap can depend on another stat or on the story clock.
2. As a world author, I want to set a stat's minimum from code, so that a floor can rise as the story progresses.
3. As a world author, I want to set a stat's regen from code, so that recovery speed can depend on state such as a daypart or another stat's band.
4. As a world author, I want to set a stat's value from code the way I do today, so that existing worlds keep working with no edits.
5. As a world author, I want a bare number return to keep meaning "set the value", so that my existing code and the templates do not break.
6. As a world author, I want to see the AI's requested change to a stat's value and maximum, so that I can clamp or scale it before it applies.
7. As a world author, I want to see the stat's pre-turn value and maximum, so that I can compute what this turn actually moved.
8. As a world author, I want to see the regen amount applied this turn, so that I can separate it from the AI's change.
9. As a world author, I want a field I do not write to keep the pipeline's own result, so that I can write code that only touches one thing.
10. As a world author, I want a value my code sets to be the one that applies for that field, so that traits and AI asks cannot silently undo it.
11. As a world author, I want a trait toggled mid-game not to wipe what my code set, so that bounds stay predictable.
12. As a world author, I want code to write only its own stat's bounds, so that two stats' scripts can never race for the same field.
13. As a world author, I want to read every other stat's data as today, so that cross-stat formulas keep working.
14. As a world author, I want to read a placeholder's current resolved text from code, so that a stat can branch on a placeholder's state.
15. As a world author, I want to read a placeholder's full authored value list from code, so that I can pick a value without knowing its text.
16. As a world author, I want a weighted draw over a placeholder's values, so that the weights I set on the Placeholders tab still count.
17. As a world author, I want to assign any text to a placeholder from code, so that a variable placeholder can carry a computed or off-list value.
18. As a world author, I want a placeholder set from code to hold until my code changes it again, so that the narration sees the same value across turns.
19. As a world author, I want a code-set placeholder to mask the roll, not replace it, so that the roll returns when the code unpins it.
20. As a world author, I want a placeholder value that is itself a chip to read as its resolved chain, so that `values` is usable text.
21. As a world author, I want an assignment to `placeholders.<name>` without `.value` to still work, so that the likely typo does not silently do nothing.
22. As a world author, I want completions for `self`, `placeholders`, and the new fields, so that I discover the surface while typing.
23. As a world author, I want the editor to flag a write to a field the sandbox does not have, so that a typo is a diagnostic and not a silent no-op.
24. As a world author, I want the editor to flag a placeholder name that does not exist, so that a rename does not break my code silently.
25. As a world author, I want the editor to warn when two placeholders share a name, so that I know which one the map reaches.
26. As a world author, I want the Test Code button to show every field and placeholder my code set, so that I can see the whole effect of a run.
27. As a world author, I want the Test Bench to check stat code under the new surface, so that its findings stay true.
28. As a world author, I want templates that demonstrate a bounds write and a placeholder write, so that I have a starting point.
29. As a world author, I want the help text for stat code to describe the new surface, so that I do not need the wiki open.
30. As a player, I want a re-rolled turn to reproduce the same code effects, so that a re-roll does not lose or double a code-set bound.
31. As a player, I want undo to restore code-set bounds and placeholders, so that rewinding restores the whole state.
32. As a player, I want the stat bar and delta text to reflect code-set movement, so that live feedback matches the history view.
33. As a player, I want the AI to read a code-set placeholder in the next prompt, so that the story follows the change.
34. As a player, I want a save written before this feature to load unchanged, so that old playthroughs keep working.
35. As a player, I want code that throws or times out to leave the stat and placeholders unchanged, so that a bad script cannot corrupt a save.
36. As a player, I want a disabled stat's code to stay inert, so that hidden stats do not move placeholders.
37. As a community world downloader, I want stat code to stay inside the sandbox, so that a downloaded world still cannot reach the page.
38. As a world author, I want to read whether a trait is enabled from code, so that a stat can depend on a trait being in force.
39. As a world author, I want to read whether the player has acquired a trait from code, so that I can tell "switched off" from "never taken".
40. As a world author, I want to switch a trait on or off from code, so that a threshold can grant or revoke a trait without the AI or the player acting.
41. As a world author, I want a code switch-on of a trait the player has not acquired to acquire it, so that code can grant new traits, not only re-enable acquired ones.
42. As a world author, I want a code switch-on to retire exclusive siblings the way the player's checkbox does, so that group rules hold no matter who flips the trait.
43. As a world author, I want the editor to flag a trait name that does not exist, so that a rename does not break my code silently.
44. As a player, I want a trait switched by code to show in the turn log like any other switch, so that I know why my traits changed.
45. As a player, I want a trait switched by code to stay switched until something switches it again, so that the toggle behaves like every other toggle.
46. As a player, I want to flip a code-switched trait back myself when the author marked it Player Can Toggle In-Game, so that code does not lock a checkbox the author gave me.
47. As a world author, I want code to switch a trait the player cannot toggle, so that a curse or a rank can be code-driven without handing the player a checkbox.

## Implementation Decisions

**Sandbox surface**

- `self` is the marshaled entry for the current stat, the same object that also sits in `stats`. `currentStatId` stays for back-compat but is no longer needed.
- Every stat entry gains `previous` (value and max at the start of the turn), `requested` (the AI's asked value and max change, raw, before flags and clamping; zero on turns with no ask), and `regenApplied` (the regen amount applied this turn, after the enabled gate and clamping).
- `self.value`, `self.min`, `self.max`, and `self.regen` are the writable fields. Writes to other stats' entries are ignored on the way out; `stats` is read-only data by construction.
- `placeholders` is an object keyed by placeholder name. Each entry is `{ value, values, roll }`. `value` is the current resolved text under this playthrough's rolls and active pins. `values` is every authored value resolved to text, in authored order, benched values (weight 0) included. `roll()` returns one value text drawn with the author's weights and has no side effect.
- Names that are not valid identifiers are reached with bracket syntax. Two placeholders with the same name collide on the map; the last one authored wins and the editor warns.
- Return semantics: a number sets `self.value`. `undefined` or no return means "apply what was written". Any other return type is the existing non-number failure.
- The host marshals `self` and `placeholders` back out after the run and diffs them against what it injected. A field whose value changed is a code write. A field left alone keeps the pipeline's result. A string assigned to a placeholder entry instead of its `value` counts as a write to `value`.
- Timeout, memory, and stack caps are unchanged. Any failure discards every write from that run.

**Own-stat bounds**

- Code writes to `min`, `max`, and `regen` are absolute for that field. They are stored on the player stat as code bounds beside the existing base fields and the AI max delta.
- Effective bounds derivation gains a final step: a code bound, when present, replaces the base-plus-traits-plus-AI result for that field. Max stays floored at effective min; value stays clamped to the effective range.
- A code bound persists until the next run of that stat's code, which either rewrites it or leaves it. Empty code clears all code bounds for that stat. The AI max delta keeps accumulating underneath so that clearing a code bound returns to the derived cap.
- A code write to `value` is applied after the bounds write and clamped to the new range.

**Placeholder writes and reads**

- A code write to a placeholder becomes a Code Pin: a new Pin source keyed by placeholder id, holding the written text. Code Pins outrank every other pin source. The Roll underneath is never replaced.
- A Code Pin holds across turns until code changes it. `placeholders.<name>.unpin()` releases it, and the Roll shows again. The release lands after the run; `value` keeps its run-start text for the rest of the run. In one run the last of a write and an `unpin()` wins. `unpin()` on a placeholder that no code pinned does nothing. Assigning `null` is not a release.
- Code Pins live in the snapshotted gameplay state, not on the save envelope beside the memory maps, so undo and re-roll restore them.
- Code Pins are read by the resolver in every place trait pins are read: prompt context, stat name resolution, the immersive view.
- Reading `placeholders` requires resolving every placeholder once per run under current rolls and pins. Resolution during the run does not mint rolls; a placeholder with no roll yet reads as its draw would and the minted roll is discarded.
- A write to a placeholder name that does not exist is dropped and reported as a diagnostic.

**Trait reads and writes**

- `traits` is an object keyed by trait name over every authored trait, not only the ones the player holds. Each entry is `{ enabled, acquired }`. `enabled` is true when the trait is acquired and not switched off. `acquired` is true when the trait is in the player's list, on or off: chosen at creation or acquired in play.
- `enabled` is the one writable field. Writing it goes through the same trait runtime operation the player's checkbox uses: switching on an acquired trait re-enables it, switching on an unacquired trait acquires it with its stat changes frozen as authored, switching off an acquired trait switches it off. Exclusive siblings retire on switch-on. Writing `enabled` to false on an unacquired trait is a no-op.
- A trait switch from code is a real state change, not a Pin. It persists in the trait runtime state until the player, the AI, or a later code run switches it again. The player's checkbox stays live; code may flip it back on its next run, and that is the author's problem to avoid.
- Retired siblings and the switch itself go to the turn log with the same wording as a player switch, attributed to the stat whose code did it.
- Trait switches take effect after the run, not during it. Every stat's code reads the same trait snapshot and the same effective bounds. The bounds, stat availability, and placeholder pins the switch changes are visible on the next run.
- Code ignores Player Can Toggle In-Game. That flag governs the player's checkbox and the player's acquisition only; code is the author's hand and may switch any authored trait. A code-switched trait without the flag has no checkbox, so only code, the AI, or undo moves it again.
- A trait name that does not exist is dropped and reported as a diagnostic.

**Per-turn run**

- The per-turn stat-code run takes plain inputs: the enabled stats with their pre-turn snapshot and this turn's asks, the clock, the placeholder set with rolls and active pins, and the trait runtime state with the authored traits and groups. It returns plain outputs: the stats with code bounds and values applied, the Code Pins, the next trait runtime state, and the log entries for the switches made. It replaces today's value-only result.
- The forward turn, the re-roll, and the clock-only run all go through this one function. The clock-only run passes zero asks.
- Order of application after the run: trait switches first, then effective bounds re-derived, then code bounds and values laid on top, then Code Pins. A code bound a stat wrote this run still wins over a bound its own trait switch moved.
- Live delta feedback folds in code-driven value movement as today. A code bounds change shows on the bar as a range change, not a delta.
- Run order between stats stays parallel over one snapshot. Own-stat bounds cannot conflict. Placeholder and trait writes are global: when two stats write the same target in one run, they apply in stat order and the last write wins. The editor does not detect this; it is the author's rule to keep.

**Editor**

- The surface list gains `self`, its writable fields, the three input fields, `placeholders` with its entry members, and `traits` with its entry members. The drift guard between surface and executor still holds.
- Diagnostics: a write to an unknown field on `self`, a write to another stat's entry, an unknown placeholder name, an unknown trait name, a write to `acquired`, and a bare-string assignment to a placeholder entry each get a message. The existing return-type check accepts no-return code.
- Test Code shows every field, placeholder, and trait the run wrote, beside the value. Trait switches in Test Code are shown, never applied to the authored world.
- Templates gain a bounds example, a placeholder example, and a trait example.
- Test Bench's stat code check runs under the new surface.

**Save shape**

- Player stats gain code bound fields. Gameplay state gains a Code Pins map. Both are additive and optional; a save without them loads as before. This is a save envelope shape change and needs the user's version call.
- The world export is unchanged. `Stat.code` stays a string.

## Testing Decisions

A good test drives a plain input through a seam and asserts the plain output. It never reads React state or the DOM to learn what stat code did.

- **Primary seam: the per-turn run.** Given stats, clock, asks, snapshot, and a placeholder set, assert the returned stats and Code Pins. Cases: number return unchanged; object writes to each bound; omitted field keeps the pipeline result; AI ask clamped by code; own-stat only; placeholder read, list, weighted roll, write, off-list text, unknown name; trait read of enabled and acquired, switch-on acquired, switch-on unacquired acquires, switch-on unacquired without Player Can Toggle In-Game still acquires, switch-off, sibling retirement, unknown name, switch-off unacquired no-op; two stats writing one target apply in stat order; trait switch lands after the run and a code bound still wins over it; failure discards all writes; disabled stat inert; clock-only turn with zero asks. Prior art: the existing tests beside the gameplay stat-code utility.
- **Executor.** Marshaling in and out only: `self` identity with `stats`, the diff rule, bare-string placeholder assignment, `roll()` respecting weights via an injected picker. Prior art: the executor's own test file.
- **Effective bounds derivation.** Code bound replaces the derived result; trait toggle does not wipe it; clearing returns the derived cap. Prior art: the trait runtime tests.
- **Resolver pin rank.** A Code Pin outranks a stat band pin and masks, not replaces, the Roll. Prior art: the placeholder resolver tests on pin ordering.
- **Editor analysis and surface guard.** Each new diagnostic fires on its trigger and stays quiet on valid code. Prior art: the stat code analysis and surface drift tests.
- **Trait runtime.** No new operation; the run calls the existing switch operation. One test proves the run's log entries carry the stat attribution. Prior art: the trait runtime tests.
- **Save loading.** A save without the new fields loads with no code bounds and no Code Pins. Prior art: the stat backfill tests.

Mutation check: each new guard is proven by reinstating the behavior it catches once.

## Out of Scope

- Cross-stat bounds writes.
- Code on anything other than stats (traits, entities, locations).
- Exposing pin sources other than the current effective value to code.
- Persisting `roll()` results without an explicit write.
- Writing `acquired` directly, or removing a trait from the player's list from code.
- Code on trait fields other than the enabled state (stat changes, pins, toggles stay authored).
- Prompt changes. The AI reads Code Pins through the existing placeholder context; no prompt text moves.
- The additions the author still intends to add (see Status note).

## Further Notes

- Alternatives considered for the write surface: a returned object with optional fields, setter functions, and bare global assignment. Mutation of an injected `self` won: no return rule to teach, cross-stat writes impossible by construction, and the number return keeps working.
- Alternative for placeholder entries: an array with a bolted-on `value` property. Rejected because JSON marshaling drops extra properties on arrays; an object with a real `values` array rides in and out as plain data.
- Alternative for bounds: a delta layer like traits. Rejected because authors think in absolutes; the AI's ask is exposed as an input instead so code can still shape it.
- `roll()` is a per-entry function and does not survive the dump. The host only reads `value` back.
- Trait switches are persisted toggles while placeholder writes are Pins. The asymmetry is deliberate: a trait toggle already has a home in the trait runtime state with its own undo path, and a pin-like trait would need a second on/off source the checkbox could not see.
- Two traits sharing a name collide on the map the same way placeholders do: last authored wins, editor warns.
- Two placeholders sharing a name is already legal in the editor. The map makes the collision visible; it does not forbid it.
