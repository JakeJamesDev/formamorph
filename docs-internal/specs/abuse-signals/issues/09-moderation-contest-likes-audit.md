# 09 — Moderation: the contest likes audit

Status: ready-for-agent
Type: task
Blocked by: 08
Spec: ../spec.md (Implementation Decisions › Moderation surfaces › Likes audit; User Stories 27–29, 31)

Both repos. The pooinom case in one screen. Can be built whenever.

## Task

**Server**
- A staff endpoint for a listing returning each Liker with: username, status, account age at the time of the like, the like timestamp, a group id shared by Likers whose hashes match each other within retention, and a flag for sharing a hash with the listing's author.
- Any listing, not only contest entries — the screen is most useful there but the data is the same.
- Writes audit `signals_viewed` with the listing as target, once per call.

**Client**
- In the staff panel's listing view, the like list gains an Audit control that fetches and renders: Likers grouped by shared signal, each with account age and like time, and a marker on any Liker linked to the author.
- The existing like-removal control sits on each row so the decision and the action are one screen.

## Acceptance

- Four accounts sharing a hash render as one group of four; a Liker matching the author carries the marker; account age reads in minutes when under an hour.
- Removing a like from the audit view updates the list without a reload.
- Each open writes one audit row.

## Tests

- Supertest. Prior art: `tests/likeModeration.test.js`, `tests/likes.test.js`.
- Component test for the grouping and the author marker over a mocked response.
