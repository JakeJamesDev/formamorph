# 02: Accepted Answer on the Server

Status: done
Base: df664ed12
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high
Repo: FormamorphServer
Spec: the server spec, `docs-internal/specs/feedback-questions/spec.md` in FormamorphServer (Accept route, Thread shape, Delete trigger, Audit)

Model rationale: the schema's first trigger, with SQLite foreign-key ordering that an `AFTER` trigger gets wrong, and status rules that interlock with ticket 01's.

## What to build

The asker or staff can mark one reply on a question as its accepted answer, change it, or clear it. Accepting sets `answered`; clearing sets `open`. A closed question stays closed either way. When the accepted reply is deleted, the question returns to `open`. Every thread response carries the accepted answer, so a client can pin it.

## Acceptance criteria

- [x] A schema step after ticket 01's rebuild adds `feedback.accepted_comment_id`, nullable, referencing `feedback_comments(id)` with `ON DELETE SET NULL`. The fresh-database definition has it too. Verified: `acceptedAnswer` step after `feedbackQuestions`; `tables.js` has the column. Schema test "has the column and the trigger on a legacy/fresh database".
- [x] A `BEFORE DELETE ON feedback_comments` trigger clears the owning question's accepted answer and sets `answered` back to `open`. A test asserts the trigger exists on the fresh and the migrated path. Verified: shared SQL in `src/schema/triggers.js`. Schema tests "has the column and the trigger" and "reopens an answered question…" on both paths.
- [x] `PUT /api/feedback/:id/answer` takes `{ commentId: string | null }`. It refuses a non-question (400), a caller who is not the asker or staff (403), and a comment from another thread (400). Verified: tests "refuses a thread that is not a question", "refuses a caller who is neither…", "refuses a comment from another thread", "refuses a missing or malformed comment id".
- [x] The asker can accept their own comment. Accepting and clearing work on a locked question. Verified: tests "lets the asker accept their own reply", "lets the asker accept and clear on a locked question".
- [x] Status moves only between `open` and `answered`. On a `closed` question the answer is stored or cleared and the status stays `closed`. Verified: tests "changes the answer, then clears it back to `open`", "stores and clears the answer on a closed question", "keeps an answered question `answered` when staff set it open".
- [x] Reopening a closed question with an accepted answer sets `answered`. Verified: test "reopens a closed question with an answer as `answered`, unlocked".
- [x] Every route that returns a thread (detail, status, vote, edit, accept) carries `acceptedAnswer` in the comment shape, or `null`. Verified: list, lock and create too (spec-session ruling). Tests "carries the answer on every route…", "carries a null answer…"; the pinned copy equals the thread's comment entry.
- [x] Any type change clears the accepted answer. Verified: test "clears the answer on any type change".
- [x] Deleting the accepted comment by its author and by staff returns the question to `open`, with foreign keys on. Verified: tests "returns the question to `open` when its author deletes it, with foreign keys on", "…when staff delete it".
- [x] Deleting the answer's author's account keeps the answer with a null author. Verified: test "keeps the answer with no author when the author's account is erased" (through `eraseUser`).
- [x] `feedback_answer_set` joins the audit actions and is written when the caller is not the asker. Verified: tests "lets staff accept on any question, and logs it against the asker", "logs staff clearing an answer", "leaves the asker's own pick out of the log", "leaves staff picking on their own question out of the log".
- [x] Each guard is proven by removing it once and watching its test fail: a stranger accepting, a non-question accepting, a foreign comment. Verified: each removal failed exactly its test (1 failed / 64). Also: an `AFTER` trigger fails 4 delete tests.

## Landed

FormamorphServer `a4c5e42`, committed by the spec session from the ticket session's recipe. On `afa69f3` plus this change alone, the full server suite passes except `globalRateLimit`, a known flake this ticket does not touch (2251 passed, 2 skipped, 44 s wall).

Shared-tree run: 2275 of 2277 pass in 28 s. The two failures are the listing-review peer's in-progress `pending_updates` work (`smoke.test.js` table list, `pendingUpdates.test.js`).

**Not verified:** none.

**For you:**
- Take a backup and run the migration against a copy of the production database before deploy. The `feedbackQuestions` rebuild and this column both run on it.
