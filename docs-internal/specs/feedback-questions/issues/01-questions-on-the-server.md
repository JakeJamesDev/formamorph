# 01: Questions on the Server

Status: ready-for-agent
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

- [ ] A schema step rebuilds `feedback` with the question branch in the `type`, `category` and `status` CHECKs. It follows the `eventPlacements` step: non-atomic, foreign keys off, its own transaction, `PRAGMA foreign_key_check` before commit.
- [ ] The step detects that it has run from the stored `CREATE TABLE feedback` SQL, and runs after the existing `feedback` column steps.
- [ ] The fresh-database `CREATE TABLE feedback` carries the same CHECKs.
- [ ] A migration test builds the old table with rows in every state plus comments, votes and read markers, runs the schema, and reads all of them back intact. It runs on the fresh and the migrated path.
- [ ] Filing a question validates its category list and adds the asker's vote in the same transaction.
- [ ] A stranger can reply to and vote on a question. A stranger still cannot reply to a bug, and a bug still refuses votes; the refusal message names both votable types.
- [ ] The `votes` sort works for questions.
- [ ] A voter is a party to a question in both the participation clause and `hasParticipated`.
- [ ] Voting on a question records a read marker, so the voter's badge does not rise. Opening the question clears a voter's unread mark.
- [ ] Staff are not a party to a question unless they filed, replied or voted (Q23).
- [ ] The status route on a question accepts only `open` and `closed`. `closed` locks the thread; `open` on a closed question unlocks it.
- [ ] The edit route converts in all six directions. Converting into a question records a read marker for each existing voter.
- [ ] Each guard is proven by removing it once and watching its test fail: a bug taking a vote, `answered` set through the status route, a stranger replying to a bug.
- [ ] Tests that pin two types are updated: the type list, the vote refusal message, and the create response's `voted` field.
