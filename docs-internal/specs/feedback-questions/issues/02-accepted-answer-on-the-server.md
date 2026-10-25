# 02: Accepted Answer on the Server

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high
Repo: FormamorphServer
Spec: the server spec, `docs-internal/specs/feedback-questions/spec.md` in FormamorphServer (Accept route, Thread shape, Delete trigger, Audit)

Model rationale: the schema's first trigger, with SQLite foreign-key ordering that an `AFTER` trigger gets wrong, and status rules that interlock with ticket 01's.

## What to build

The asker or staff can mark one reply on a question as its accepted answer, change it, or clear it. Accepting sets `answered`; clearing sets `open`. A closed question stays closed either way. When the accepted reply is deleted, the question returns to `open`. Every thread response carries the accepted answer, so a client can pin it.

## Acceptance criteria

- [ ] A schema step after ticket 01's rebuild adds `feedback.accepted_comment_id`, nullable, referencing `feedback_comments(id)` with `ON DELETE SET NULL`. The fresh-database definition has it too.
- [ ] A `BEFORE DELETE ON feedback_comments` trigger clears the owning question's accepted answer and sets `answered` back to `open`. A test asserts the trigger exists on the fresh and the migrated path.
- [ ] `PUT /api/feedback/:id/answer` takes `{ commentId: string | null }`. It refuses a non-question (400), a caller who is not the asker or staff (403), and a comment from another thread (400).
- [ ] The asker can accept their own comment. Accepting and clearing work on a locked question.
- [ ] Status moves only between `open` and `answered`. On a `closed` question the answer is stored or cleared and the status stays `closed`.
- [ ] Reopening a closed question with an accepted answer sets `answered`.
- [ ] Every route that returns a thread (detail, status, vote, edit, accept) carries `acceptedAnswer` in the comment shape, or `null`.
- [ ] Any type change clears the accepted answer.
- [ ] Deleting the accepted comment by its author and by staff returns the question to `open`, with foreign keys on.
- [ ] Deleting the answer's author's account keeps the answer with a null author.
- [ ] `feedback_answer_set` joins the audit actions and is written when the caller is not the asker.
- [ ] Each guard is proven by removing it once and watching its test fail: a stranger accepting, a non-question accepting, a foreign comment.
