# 01: Server Comment Targets

Status: done
Base: a6002e4
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium
Spec: ../spec.md (Q2, Q6, Q9, Q10; Server)

Repo: FormamorphServer

Reuses the existing resolver behind feedback targets on a known response shape, so the work is contained.

## What to build

Listing comment reads, creates and edits return `targets` for their text, resolved for the reader making the request. The shape is the one feedback comments carry. A page of comments resolves in one batch. Nothing new is stored, and a mention writes no row and has no cap.

## Acceptance criteria

- [x] A comment list read returns `targets` on every comment, with one entry per distinct target. Test: an HTTP request against the comments route. (`tests/commentTargets.test.js`, "come with every comment, one entry per distinct target")
- [x] A create and an edit response carry `targets` for the new text. Test: HTTP requests. ("targets on a create and an edit", two tests)
- [x] A thread the reader can't read and a hidden listing arrive as unavailable, with no name, title or type. A guest gets the guest result. Test: HTTP requests as a guest and as a signed-in reader. (bug thread as guest vs signed-in; unlisted listing; mutation of the reader argument turned the guest/reader test red)
- [x] An unmatched `@name` arrives as an unavailable user target. Test: HTTP request. ("give an unmatched name as an unavailable user")
- [x] A comment with more mentions than the feedback caps allow is accepted, and no mention row is written. Test: HTTP request and a read of the mention rows through the feedback surface. (12 mentions accepted; `feedback_mentions` count unchanged, read from the table, not through a feedback route)
- [x] The stored comment text stays as typed. Test: read it back. ("leave the stored text as typed", read from the `comments` table)

## Landed

**Not verified**
- Mention rows are counted straight from the `feedback_mentions` table, not through a feedback HTTP route. The feedback routes expose no mention list.
- `GET /api/comments/:id` (single comment) is unchanged and returns no `targets`. The ticket and spec name list reads, creates and edits only.

**For you**
- None.
