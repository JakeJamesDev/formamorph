# 06: Stat Code Reads And Switches Traits

Status: ready-for-agent
Blocked by: 03
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: high

A trait switch re-derives bounds, toggles stat availability, and moves placeholder pins. Ordering against code bounds in the same run and correct attribution in the turn log both need care, so Opus at high effort.

## What to build

The sandbox injects `traits`, an object keyed by trait name over every authored trait. Each entry is `{ enabled, acquired }`. `enabled` is true when the trait is acquired and not switched off. `acquired` is true when the trait is in the player's list, on or off. Only `enabled` is writable.

Writing `enabled` goes through the same trait runtime switch the player's checkbox uses. Switch-on of an acquired trait re-enables it. Switch-on of an unacquired trait acquires it with its stat changes frozen as authored. Switch-off of an acquired trait switches it off. Switch-off of an unacquired trait is a no-op. Exclusive siblings retire on switch-on. Code ignores Player Can Toggle In-Game; that flag governs the player's checkbox only. The switch and any retired siblings go to the turn log with the player-switch wording, attributed to the stat whose code did it.

Switches land after the run. Every stat reads one trait snapshot. Application order: trait switches, then bounds re-derived, then code bounds and values on top, then Code Pins. A code bound written this run still wins over a bound the trait switch moved. Two stats switching one trait apply in stat order, last wins. A trait name that does not exist is dropped and reported. A write to `acquired` is a diagnostic.

Test Code shows the switches the run would make and never applies them to the authored world.

## Acceptance criteria

- [ ] `traits.<name>.enabled` and `.acquired` read the three trait states correctly
- [ ] Switch-on acquired, switch-on unacquired (with and without Player Can Toggle In-Game), switch-off acquired, and switch-off unacquired each behave as specified
- [ ] Exclusive siblings retire on a code switch-on
- [ ] Turn log carries the switch and retirements, attributed to the stat
- [ ] A code bound written in the same run wins over the bound the trait switch moved
- [ ] Two stats switching one trait apply in stat order, last wins
- [ ] Unknown trait name and a write to `acquired` each produce a diagnostic
- [ ] Undo restores the pre-switch trait state
- [ ] Test Code shows switches without applying them
- [ ] Tests at the per-turn seam cover every switch case, ordering against code bounds, and stat-order conflict; a trait runtime test proves the log attribution
- [ ] Four gates green; graph updated

## Blocked by

- 03 — Stat Code Sets Its Own Bounds
