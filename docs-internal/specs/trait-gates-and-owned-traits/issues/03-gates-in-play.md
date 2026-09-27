# 03: Gates in play

Status: ready-for-human
Status note: built in 9a85f190 and its review follow-up; notes for later tickets under Comments.
Base: 9ab25d6d
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

## Comments

**Hand-over (2026-09-26).** The in-play seam is `settleTraits`, `switchPlayerTrait` and `applyCodeTraitSwitches` in `src/lib/traitRuntime.ts`. Notes for later tickets:

- **Rulings applied (spec session, Q1–Q4):** a code switch-on the gate refuses retires no sibling and joins the cascade-off list; a code cascade writes log lines only, no banner; returns log "Trait switched on: X" with no banner.
- **Decided here:** a code switch-off of a trait already on the cascade-off list takes it off the list, so it never returns. This matches a hand switch-off.
- **Ticket 09 (owned traits in play):** the runtime settles the `world` owner only. `cascadeOffTraitIds` is keyed by owner and merges other owners' lists untouched.
- **Live preview:** real clicks in the White Room fixture showed locked rows, "Unlocked by" lines and the banner "Turned off Order Crest and Plate Armor, because of Rogue." Parallel sessions' edits kept reloading the shared dev server, so only the locked-row frame has a light-theme screenshot. The banner and dark theme have no screenshot.
- **Not changed:** a stat re-roll gates against the live persona, not the persona of the turn it replays. The per-turn snapshot does not hold the persona.
