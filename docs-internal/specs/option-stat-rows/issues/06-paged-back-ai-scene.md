# 06: Paged-Back AI Scene

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

On a paged-back turn, the AI scene's entity stats read the current Option values for Option toggles, while the panels read that turn's values. The scene must read the viewed turn's values. Also widen the Q17 no-leak test: it covers the narration request and global rows only. Add entity rows and the stat pass request.

## Acceptance criteria

- [x] On a paged-back turn whose Option value differs from the current one, the scene's entity stats follow the viewed turn's value. `GameViewer.optionStatRows.test.tsx` "switches a paged-back turn’s entity stats…".
- [x] No Option row text reaches the narration or stat pass request, for global and entity rows. Same file, "adds nothing to the AI request…", now with an entity row and the stat pass.
- [x] Each guard goes red with its bug reinstated. The paged-back test fails with the old `entityInForceUnder(viewOwnedTraits)` call. The request test fails when an entity row changes the golem's max.

## Landed

**Not verified**
- Nothing in the no-leak test goes red from a row joining the prompt as text. I proved it only against a row that changes the stat's displayed value.

**For you**
- None. The spec session agreed the target is the avatar-morph effect, since the live AI scene already reads current values.
