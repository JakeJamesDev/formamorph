# 02: Shared Author Serializer

Status: ready-for-human
Base: e35ca129
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium
Repo: FormamorphServer
Spec: ../spec.md (Implementation Decisions › Author payloads)

Model rationale: a mechanical refactor across about seven call sites with existing tests as the net.

## What to build

One server function builds the author object `{ id, username, avatarUrl, role }`. Every place that builds it by hand today uses the function: listings, comments, follows and notifications, feedback threads and replies, and the public profile.

This is a prefactor. No payload changes. Ticket 04 adds the `supporter` field in this one place.

## Acceptance criteria

- [ ] One function builds the author object. No model or controller repeats the shape.
- [ ] Every payload is byte-for-byte the same as before for the same data. The existing route tests pass without edits to their assertions.
- [ ] Feedback keeps its role snapshot behavior, with the live value as the fallback.
- [ ] The Likers row is not changed. Its missing role is a known adjacent bug, outside this effort.
- [ ] A test calls the function directly for a normal account, each staff role, and an account with no Profile Image.
- [ ] Server gates green.
