# 03: Gates in play

Status: ready-for-agent
Blocked by: 01 — Gate module and enter-world gates
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: touches the trait runtime's stat reversal, the save envelope, and stat-code switches, where an ordering mistake farms stats.

Parent: [Trait Gates and Owned Traits spec](../spec.md)

## What to build

The same gates and cascade hold after the game starts. Switching a trait off in the Traits tab, changing persona, or a stat-code switch cascades through `settle`. Traits a cascade turned off reverse their stats honestly, come back on their own when the gate holds again, and the story log records each change.

## Acceptance criteria

- [ ] Trait switches in the trait runtime, persona changes, and stat-code trait switches go through `settle`.
- [ ] World traits a cascade turns off reverse their stats through the existing honest reversal, dependents first.
- [ ] The save stores, per owner, the ids a cascade turned off. This is an additive save export change. Load reads a save without it as empty.
- [ ] A trait on the cascade-off list switches back on when its gate holds again; a trait the player switched off by hand stays off. A return never retires a picked exclusive sibling: the trait stays off and leaves the list.
- [ ] Stat code ignores Player Can Toggle but not gates: a code switch-on of a locked trait acquires it and `settle` turns it off in the same pass, with a switch-off log line. The sandbox's `traits` entries do not change.
- [ ] The story log notes each cascade with the existing switch-log wording.
- [ ] The in-game Traits tab shows locked rows and the cascade banner as enter-world does.
- [ ] Trait runtime tests: a cascade in play reverses stats honestly, toggling stays neutral, a code switch-on of a locked trait, a return after the gate holds again, a hand switch-off that never returns, a return blocked by a picked sibling. Save round-trip tests cover the cascade-off list.
- [ ] Verify the changed UI in the live preview with static DOM or frame evidence, both themes, at a realistic viewport.

## Completion checks

- [ ] Run typecheck, lint, tests, and the build; report the timed test result and investigate unexplained process tail time.
- [ ] Prove each new guard fails when its rule is removed; never remove a real trigger to go green.
- [ ] State every export-shape change in the response.
- [ ] Add the In-Progress changelog entry, update the code graph, and complete the shared-code side-effect scan.
