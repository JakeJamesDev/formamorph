# 03: Status Defaults and User Status Filter

Status: ready-for-agent
Blocked by: 01, 02
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

**Parent:** [Feedback List Search and Filters](../spec.md)

**Work tree:** this repo only.

**What to build:** Every feedback list opens on the threads that still need work: Still Open on Suggestions, Unresolved on Bugs (Q4). This covers the staff queues, the users' Everyone's view, and the users' own view. Users get a status filter with the same options as staff: All, Still Open or Unresolved, then each state (Q3).

The control sits in the filter row for now. Ticket 07 moves it into the hidden filters. The staff Suggestions comment that justifies opening on All goes away with that default.

- [ ] Staff Bugs and Suggestions open on Unresolved and Still Open
- [ ] User Bugs and Suggestions open on Unresolved and Still Open in both scopes
- [ ] The user status filter offers the staff options and reaches the request
- [ ] Picking All shows closed threads again
- [ ] The status options and defaults come from the presentation module, one source for both tabs
- [ ] Tests at the tab seam with `FeedbackService.list` mocked
- [ ] Changelog line under In Progress
