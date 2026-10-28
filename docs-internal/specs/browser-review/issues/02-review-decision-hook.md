# 02: Review Decision Hook

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Model note: behavior-preserving extraction across dialogs and conflict paths
Reasoning effort: high

## What to build

Prefactor. The Review tab's approve and reject orchestration moves into one shared hook, which the Review tab then uses. Players and mods see no change. See the spec's **Review decision hook** module.

## Acceptance criteria

- [ ] The hook owns the busy state, the quarantine-days dialog for a new listing, the confirm for an update or a resubmitted listing, and the composer with the right template.
- [ ] The hook owns the may-decide check: not the viewer's own listing, and `canModerate` against the author.
- [ ] The hook handles both 409 cases: `CONTEST_LOCKED` keeps the item; any other conflict drops it with "Another mod already handled this".
- [ ] The hook reports each outcome (approved, rejected, dropped, kept) so the caller updates its own list.
- [ ] The hook's own test file covers approve, reject of a new listing with days, reject of an update, both conflicts and the template choice.
- [ ] The existing Review tab tests pass with no assertion weakened or removed.
