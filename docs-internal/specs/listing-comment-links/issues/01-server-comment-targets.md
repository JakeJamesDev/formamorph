# 01: Server Comment Targets

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium
Spec: ../spec.md (Q2, Q6, Q9, Q10; Server)

Repo: FormamorphServer

Reuses the existing resolver behind feedback targets on a known response shape, so the work is contained.

## What to build

Listing comment reads, creates and edits return `targets` for their text, resolved for the reader making the request. The shape is the one feedback comments carry. A page of comments resolves in one batch. Nothing new is stored, and a mention writes no row and has no cap.

## Acceptance criteria

- [ ] A comment list read returns `targets` on every comment, with one entry per distinct target. Test: an HTTP request against the comments route.
- [ ] A create and an edit response carry `targets` for the new text. Test: HTTP requests.
- [ ] A thread the reader can't read and a hidden listing arrive as unavailable, with no name, title or type. A guest gets the guest result. Test: HTTP requests as a guest and as a signed-in reader.
- [ ] An unmatched `@name` arrives as an unavailable user target. Test: HTTP request.
- [ ] A comment with more mentions than the feedback caps allow is accepted, and no mention row is written. Test: HTTP request and a read of the mention rows through the feedback surface.
- [ ] The stored comment text stays as typed. Test: read it back.
