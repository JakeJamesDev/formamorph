# 02: Review Decision Hook

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Model note: behavior-preserving extraction across dialogs and conflict paths
Reasoning effort: high

## What to build

Prefactor. The Review tab's approve and reject orchestration moves into one shared hook, which the Review tab then uses. Players and mods see no change. See the spec's **Review decision hook** module.

## Acceptance criteria

- [x] The hook owns the busy state, the quarantine-days dialog for a new listing, the confirm for an update or a resubmitted listing, and the composer with the right template. `useReviewDecision.test.tsx` "rejecting" and "marks only the subject in flight as busy" (`busyId` per subject).
- [x] The hook owns the may-decide check: not the viewer's own listing, and `canModerate` against the author. "who may decide" tests; own-listing and ladder mutations went red.
- [x] The hook handles both 409 cases: `CONTEST_LOCKED` keeps the item; any other conflict drops it with "Another mod already handled this item". "the 409 conflicts" tests; both mutations went red.
- [x] The hook reports each outcome (approved, rejected, dropped, kept) so the caller updates its own list. `onOutcome` asserted per case; ReviewTab drops on all but `kept`.
- [x] The hook's own test file covers approve, reject of a new listing with days, reject of an update, both conflicts and the template choice. 14 tests, 100% lines; days and template-swap mutations went red.
- [x] The existing Review tab tests pass with no assertion weakened or removed. `ReviewTab.test.tsx` is not in the diff; 25/25 green.

## Landed

**Not verified**

- None.

**For you**

- None: a prefactor with no visible change. Ticket 04 carries the live-server check.
