# 12: A clear press always works

Status: ready-for-agent
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

- [ ] A clear press removes the Install's own Anonymous Like while the setting is off. A like press is still refused with the off code.
- [ ] A clear press removes the Install's own Anonymous Like on a listing that is unlisted or quarantined.
- [ ] A clear press with no stored row follows the normal order, so a hidden listing the Install never liked still answers as not found.
- [ ] The guest `liked` flag is still returned while the setting is off, so the client can show a filled heart that can be cleared. Add the test if none exists.
- [ ] The header check still runs first; a malformed Install header is refused as before.
- [ ] The answer keeps the route's shape.
- [ ] Each new path has a test that fails when the early clear is removed.
- [ ] `npm test` green. State the run time in the hand-over.
