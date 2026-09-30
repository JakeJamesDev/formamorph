# 03: Hide contest likes in user listings and profile totals

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium
Repo: FormamorphServer
Spec: ../spec.md (Implementation Decisions › Routes)

Model rationale: two read paths and one SQL sum that needs a reader-aware filter.

## What to build

A player opens an author's profile during a contest. The author's listing rows follow the hidden-count contract, and the like total leaves out hidden likes. Without this, a player could subtract totals to learn an entry's count. The author and staff see the full total.

## Acceptance criteria

- [ ] "My listings" and another user's listings follow the ticket 01 contract per row.
- [ ] Profile totals (by id and by username) leave hidden likes out for a public reader.
- [ ] The author and staff get the full total.
- [ ] Route tests: an author with one hidden entry and one normal listing. A public reader's total equals the normal listing's likes; the author's total equals both.
- [ ] The guard bites: removing the filter makes the public-total test fail.
- [ ] Server gates green.
