# 12: A clear press always works

Status: ready-for-human
Base: 1745a81f
Blocked by: 01, 03
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium
Repo: FormamorphServer
Spec: ../spec.md (Implementation Decisions › Server; User Stories › Privacy)

Model rationale: one reordered guard in one handler, with the pattern already present two guards further down.

## What to build

The privacy text promises that pressing the heart again takes an Anonymous Like back. Two guards break that promise today: the route refuses every press while the setting is off, and it answers 404 for a listing that is no longer visible. A person who liked before either change cannot take the like back.

When the press is a clear and the Install holds an Anonymous Like on that listing, the server deletes it and answers, before the off check and the visibility check.

## Acceptance criteria

- [x] A clear press removes the Install's own Anonymous Like while the setting is off. A like press is still refused with the off code.
- [x] A clear press removes the Install's own Anonymous Like on a listing that is unlisted or quarantined.
- [x] A clear press with no stored row follows the normal order, so a hidden listing the Install never liked still answers as not found.
- [x] The guest `liked` flag is still returned while the setting is off, so the client can show a filled heart that can be cleared. Add the test if none exists.
- [x] The early clear is a narrow pass-through: a well-formed Install header, a clear press, and a stored row. Every other request falls through to today's order unchanged. A malformed header while the setting is off still answers the off code, so the existing "answers the switch before anything else" test stays as it is.
- [x] When a row exists, the early clear always deletes it. If the Install's account holds the account Like, the answer stays the 200 with `liked: true` and the already-liked code, with the count after the delete. Otherwise the answer is `liked: false`.
- [x] Tests: setting off + malformed header + clear press answers the off code; setting off + stored row + clear removes it; account holds the Like + stored row removes the row and answers liked true.
- [x] The answer keeps the route's shape.
- [x] Each new path has a test that fails when the early clear is removed.
- [x] `npm test` green. State the run time in the hand-over.

## Comments

Landed in FormamorphServer as `247fb75`, "Let A Clear Press Reach A Mark The Guards Now Hide". The `Base:` line above names a commit in this repo; the server range reviewed was `bb3b8e4..HEAD`.

The early clear is a pass-through named `answerForClearedMark` in `src/controllers/worldController.js`. It answers only with all three of a well-formed Install, a clear press, and a stored mark. Everything else falls through to the order that was already there, so the off switch stays un-probeable.

Eight tests added in `tests/anonymousLikes.test.js`. Five of them go red when the early clear is removed, which is every new path. The other three protect what must not change: the 404 for a hidden listing the Install never marked, the off code for a malformed header on a clear press, and the guest heart filled while the setting is off.

Review folded in: the already-likes answer is now one function both the early clear and the guard below call, the helper name says it returns a body, and the guard's comment no longer claims the clear half.

`npm test`: 1678 tests in 51 files, all green, 23.67s.
