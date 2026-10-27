# 02: Server Thread Numbers

Status: done
Base: 08047b8
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium
Spec: ../spec.md (Q7, Q13); server spec: Thread number

Repo: FormamorphServer

## What to build

Every feedback thread has a short number from one sequence shared by bugs, suggestions and questions. Existing threads are numbered in creation order. Every thread DTO returns `number`, and a thread read accepts a number as well as the UUID.

## Acceptance criteria

- [x] A schema step adds a unique, non-null `number` and backfills existing rows in creation order, ties broken by id. The boot-schema drift test passes. (`bootSchema.test.js`: "numbers the threads already there…", "brings the oldest schema up to the current one, shape for shape", "refuses a second thread with a number already taken")
- [x] A new thread of any type takes the next number, inside the insert's transaction. (`feedbackNumbers.test.js`: "comes from one sequence…", "is never handed out again after its thread is deleted")
- [x] List and thread DTOs return `number`. (`feedbackNumbers.test.js`: list and thread-read tests)
- [x] A thread read by number returns the same thread as by UUID, with the same read rules. (`feedbackNumbers.test.js`: same body by UUID and number, guest bug 404, seen-marker, zero-padded number refused)

## Landed

**Not verified**
- Concurrent filings from two server processes on one database file. The server runs one process; a clash would fail on the unique index.

**For you**
- Number is never reused (spec session ruling, to become Q30). A counter table `feedback_sequence` holds the last number. Only `GET /api/feedback/:id` accepts a number; the comment, vote and status routes still take the UUID only.
- Existing tests that insert into `feedback` by hand now supply a number. The column defaults to 0 only so ALTER can add it to an old table.
