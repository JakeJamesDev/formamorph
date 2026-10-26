# 01: Questions on the Server

Status: ready-for-human
Base: 2916ccee6
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high
Repo: FormamorphServer
Spec: the server spec, `docs-internal/specs/feedback-questions/spec.md` in FormamorphServer (Rulings, API Contract, Implementation Decisions)

Model rationale: the `feedback` table rebuild runs against live data with three cascading child tables. A wrong pattern deletes every comment, vote and read marker.

## What to build

A player can file a question. Anyone signed in can read it, reply to it, and vote on it. The asker's own vote is counted at filing. Voters get unread marks on new replies, and the marks clear when they open the question. Staff can close a question, which locks it, and reopen it, which unlocks it. Staff can convert a thread between bug, suggestion and question.

This ticket owns the server's "votable board" predicate (suggestion or question). The accepted answer is ticket 02. Word search is ticket 03.

## Acceptance criteria

- [x] A schema step rebuilds `feedback` with the question branch in the `type`, `category` and `status` CHECKs. It follows the `eventPlacements` step: non-atomic, foreign keys off, its own transaction, `PRAGMA foreign_key_check` before commit. ✓ `feedbackQuestionsSchema` legacy test; FK-off mutation goes red
- [x] The step detects that it has run from the stored `CREATE TABLE feedback` SQL, and runs after the existing `feedback` column steps. ✓ 'runs once' + 'fresh database' tests; placed after `feedbackEdited`
- [x] The fresh-database `CREATE TABLE feedback` carries the same CHECKs. ✓ 'fresh database' test, `expectQuestionChecks`
- [x] A migration test builds the old table with rows in every state plus comments, votes and read markers, runs the schema, and reads all of them back intact. It runs on the fresh and the migrated path. ✓ `feedbackQuestionsSchema.test.js`, incl. null-column rows and indexes
- [x] Filing a question validates its category list and adds the asker's vote in the same transaction. ✓ 'filing a question' tests
- [x] A stranger can reply to and vote on a question. A stranger still cannot reply to a bug, and a bug still refuses votes; the refusal message names both votable types. ✓ 'replies' + 'votes' tests; refusal text in `feedback.test.js`
- [x] The `votes` sort works for questions. ✓ 'sorts questions by votes'
- [x] A voter is a party to a question in both the participation clause and `hasParticipated`. ✓ 'unread for voters'; mutating either side goes red
- [x] Voting on a question records a read marker, so the voter's badge does not rise. Opening the question clears a voter's unread mark. ✓ 'before the vote' + 'clears it when they open'
- [x] Staff are not a party to a question unless they filed, replied or voted (Q23). ✓ 'never touched' + 'once they vote'
- [x] The status route on a question accepts only `open` and `closed`. `closed` locks the thread; `open` on a closed question unlocks it. ✓ 'status' tests, incl. lock-route lock kept (spec ruling)
- [x] The edit route converts in all six directions. Converting into a question records a read marker for each existing voter. ✓ `it.each` six directions + 'becomes a question' badge test
- [x] Each guard is proven by removing it once and watching its test fail: a bug taking a vote, `answered` set through the status route, a stranger replying to a bug. ✓ 13 mutations, all red; see notes t01/README.md
- [x] Tests that pin two types are updated: the type list, the vote refusal message, and the create response's `voted` field. ✓ meta + 'refuses a vote on a bug' in `feedback.test.js`

## Landed

FormamorphServer `33288f0`, committed by the spec session from the ticket session's patches. On `f1df356` plus this change alone: the six feedback and schema suites pass (238/238, 24s wall). The full suite fails only `globalRateLimit`, which also fails 1 run in 3 alone and is untouched here.

**Not verified**: none.

**For you**:
- Back up the live database and run the migration against a copy of it before deploying (server spec, Further Notes).
