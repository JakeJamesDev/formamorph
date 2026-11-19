# 11: Test Bench Defaults Report

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

The Test Bench rule report predicts which default traits start off. It still settles defaults on authored stats, so it disagrees with real setup since ticket 08 (Q26): a default opened by another default's +3 is reported as starting off. Its comment cites Q31, but Q31's authoring readers are only the editor's Requires text, code hover cards and the library entity gate input. Settle the report's defaults through the same setup gate stats real setup uses, with the author's picked Option values.

## Acceptance criteria

- [x] A default trait opened by another default's stat row is not reported as starting off. (rules.test.ts "passes a default that another default’s stat row opens")
- [x] A default whose gate fails even with every pick's rows is still reported. (rules.test.ts "still flags a default whose gate fails with every pick’s rows")
- [x] The guard goes red with its bug reinstated. (setupGate returning the gate unchanged failed the first test)

## Landed

Option values: the report reads each Option at its default, with no change to the Rule signature (spec Q36). The stuck and loop checks stay on authored stats, since stat Conditions already count as holding in `neverUnlockable`. `ownRowsReader` in `traitGates.ts` now tolerates a trait with no `statChanges`, so the report still diagnoses a malformed world.

**Not verified**: none.

**For you**: none.
