# 05: Listing Comment Autocomplete

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: low
Spec: ../spec.md (Q4; Autocomplete)

Mounts an existing plugin in two places. The search routes already exist.

## What to build

The listing comment box, for new comments and for edits, offers the feedback `@` and `#` autocomplete. It runs with no thread, so a bare `@` lists nothing until a character follows. The app passes no thread type filter. The picked text inserts as it does in feedback.

## Acceptance criteria

- [ ] Typing `@` and a character in the new comment box lists matching names, and a pick inserts `@<stored name>` and a space. Test: the rendered modal with a mocked search.
- [ ] Typing `#` and a character lists threads, and a pick inserts `#N` and a space. Test: the same render.
- [ ] A bare `@` sends no request and shows no menu. Test: the same render.
- [ ] The comment edit box offers the same autocomplete. Test: the same render.
- [ ] Listing description and other non-comment fields in the modal offer none. Test: the same render.
