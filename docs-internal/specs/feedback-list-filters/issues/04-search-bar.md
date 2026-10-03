# 04: Search Bar

Status: done
Base: 773f369a
Blocked by: 01, 02
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

**Parent:** [Feedback List Search and Filters](../spec.md)

**Work tree:** the FormamorphServer repo first, then this repo. The client part ships only after the user deploys the server.

**What to build:** A reader types a word into the search bar on any feedback list. After a short pause, the list shows only threads whose title or body contains it (Q1, Q9). The search starts on page 1. A clear button empties it and applies at once. A search that matches nothing shows the list's empty label.

The server adds an optional search parameter to the list endpoint. It matches title or body, case-insensitively. It escapes the LIKE wildcards, so `%` and `_` match literally. Blank text means no search. The parameter has a length cap. Search combines with status, category, scope, and sort; `total` stays exact.

The bar sits in the filter row for now. Ticket 07 settles its final place. Copy follows the writing guide.

- [x] Server: hits title, hits body, misses, ignores case, treats `%` and `_` literally, ignores blank text, caps length
- [x] Server: search combines with status list, category, and scope
- [x] Client: `FeedbackService.list` sends the search text
- [x] Client: typing searches after a pause and resets to page 1; clear applies at once
- [x] Client: search survives Back and a tab switch; reopening the dialog starts empty (Q12)
- [x] Both tabs, both types
- [x] Server tests over supertest; client tests at the tab and service seams
- [x] Changelog line under In Progress (client); the deploy log is the user's
