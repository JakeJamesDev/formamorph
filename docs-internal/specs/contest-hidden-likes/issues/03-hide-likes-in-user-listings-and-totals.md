# 03: Hide contest likes in user listings and profile totals

Status: ready-for-human
Status note: server 4734172 (FormamorphServer). Totals take the viewer; listings needed route tests only. Not deployed.
Base: c4b7873b
Blocked by: 01
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium
Repo: FormamorphServer
Spec: ../spec.md (Implementation Decisions › Routes)

Model rationale: one SQL sum that needs a reader-aware filter, plus route tests.

Note from ticket 01 (server dc8c48e): user listings already follow the rule because they go through the catalog query, so they need route tests only. The total filter reuses ticket 01's SQL rule function `likes_hidden(...)` and its reader-params helper, both in the server's like-visibility module. Do not copy the rule.

## What to build

A player opens an author's profile during a contest. The author's listing rows follow the hidden-count contract, and the like total leaves out hidden likes. Without this, a player could subtract totals to learn an entry's count. The author and staff see the full total.

## Acceptance criteria

- [ ] Route tests prove that "my listings" and another user's listings follow the ticket 01 contract per row.
- [ ] Profile totals (by id and by username) leave hidden likes out for a public reader.
- [ ] The author and staff get the full total.
- [ ] Route tests: an author with one hidden entry and one normal listing. A public reader's total equals the normal listing's likes; the author's total equals both.
- [ ] The guard bites: removing the filter makes the public-total test fail.
- [ ] Server gates green.
