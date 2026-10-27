# 01: Shared Suite and Probe Default

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium
Spec: ../spec.md (Q9, Q14, Q15; Testing Decisions)

## What to build

The prefactor. After it lands, the shared bundled-world suite knows the expansion's features, the old-save check and the world probe both know the pre-expansion revision, and the changelog has the effort's one entry.

- Extend the shared suite's feature union with `tools`, `relationships`, `timeGates`, `scriptLore`, `scriptExits`, `visibilityRules`, `mapBackground`, and `newFieldChips`, each with a detector that reads the world as the seeder loads it. `scriptLore` is a script that writes a dictionary entry's `enabled`; `scriptExits` is a script that reads `location.exits`; `visibilityRules` needs a location image rule and an entity image rule; `newFieldChips` is a placeholder token in a Pronouns, Travel Hint or Relationship label field.
- Store the spec's assignment table as the planned rows. A world ticket moves each feature it delivers from planned into its row. The set check for the new features turns on once no planned feature is left unclaimed, so the suite is green before any world ticket lands and strict after the last.
- Record this ticket's `Base:` sha as the pre-expansion revision. The old-save check reads each of the seven worlds at that revision as well as at the pre-refresh revision, and plays one turn against the working-tree world. The world probe's default before arm becomes that revision.
- Write the effort's one Major changelog entry as a fragment. The lead states the player outcome: the bundled worlds grew, with art. Later tickets fold their world into it.

## Acceptance criteria

- [x] Each new detector is shown to bite: a world edited to lack the feature fails its row check. All seven new features added to Drone's row failed `shows <feature>`; `tools` added to Valentines' row failed. Committed: `the expansion feature detectors > finds …` (false before the edit, true after) and `ignores …` near misses.
- [x] The suite is green on the current worlds with every new feature still planned, and the set check is shown to fail once with a planned feature removed from every row by hand. `bundledWorlds.test.ts` 86 pass, strict set check skipped; `scriptExits` removed from Rampage's planned row failed `shows or plans every feature`; strict check forced on failed with seven features listed.
- [x] The old-save check reads the pre-expansion revision and is shown to fail with a missing revision, never skip. `GameViewer.bundledSaves.test.tsx` 23 pass (8 pre-expansion cases); a bogus `PRE_EXPANSION_SHA` failed with git's `fatal: … not in '0000000a…'`.
- [x] The world probe runs with no `--arms` flag and reports the pre-expansion revision as its before arm. Ran against a dead endpoint: `arms worktree vs 2f45261a5`, both arms played Drone.
- [x] The changelog fragment is in place with a lead that stands alone. `docs-internal/changelog.d/bundled-worlds-expansion-01.md`, lead as ruled by the spec session.

## Landed

**Not verified**
- None.

**For you**
- Nothing to judge in play. World tickets: move each delivered feature from `PLANNED` into the world's `FEATURES` row in `src/lib/bundledWorlds.test.ts`. The `scriptLore` detector matches the inline form `dictionaries.<Book>.entries.<Entry>.enabled = …`; an aliased entry is not detected.
