# 14: Client Reads the Warning Thresholds

Status: ready-for-human
Blocked by: 13
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Model rationale: replaces one constant with a parsed field and updates the tests that used it.

**What to build:** the allowance notices use the thresholds the hosted state reports (ticket 13), not the client constant in the hosted allowance module. The constant is removed.

- [x] The hosted-state parser reads `warnThresholds`; a missing or malformed list shows no notice rather than guessing. (`shows no notice when the list is null, missing or malformed`: ten bad shapes parse to null and raise no notice)
- [x] Notices fire at the reported thresholds (test with a list other than the old constant). (`fires at the reported thresholds, not a fixed pair`, list `[50, 80]`)
- [x] The client constant is gone, and no other copy of the thresholds remains in the client. (grep for `WARN_THRESHOLDS` and `75, 90` finds only test fixtures and the staff panel's sample settings)
- [x] The guard is proven by removing it once. (`pendingWarning` read a fixed `[75, 90]`: the `[50, 80]` test went red; restored)

## Landed

**Not verified**
- The live hosted state with a real server. Tests use fixtures, so the server's `warnThresholds` shape is checked against ticket 13's description only.

**For you**
- None.

Note: the parser accepts only a non-empty, strictly ascending list of positive integers. Any other list reads as no list, so no notice shows and `settleTurn` does not move to `warned`.
