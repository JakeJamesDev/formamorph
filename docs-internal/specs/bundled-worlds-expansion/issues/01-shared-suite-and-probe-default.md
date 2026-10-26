# 01: Shared Suite and Probe Default

Status: ready-for-agent
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

- [ ] Each new detector is shown to bite: a world edited to lack the feature fails its row check.
- [ ] The suite is green on the current worlds with every new feature still planned, and the set check is shown to fail once with a planned feature removed from every row by hand.
- [ ] The old-save check reads the pre-expansion revision and is shown to fail with a missing revision, never skip.
- [ ] The world probe runs with no `--arms` flag and reports the pre-expansion revision as its before arm.
- [ ] The changelog fragment is in place with a lead that stands alone.
