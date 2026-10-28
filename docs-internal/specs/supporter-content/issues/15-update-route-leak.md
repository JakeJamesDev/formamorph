# 15: Server: no raw Supporter content in the update reply

Status: needs-triage
Repo: FormamorphServer
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Model rationale: one response path and a route test in an established suite.

## Parent

[spec.md](../spec.md) — Supporter Content and Mascot Listings. Found by the close review.

## What to build

`PUT /api/worlds/:id` answers with the listing's full content. On a Supporter-only listing that content is read from the private area with no watermark or scramble, so the author, and any moderator who sends an empty update, gets every layer clean (fails Q4 and Q31). The update reply must never carry a Supporter-only listing's content unprocessed.

## Acceptance criteria

- [ ] An update to a Supporter-only listing returns no unprocessed content: either no `contentData`, or content passed through the per-account processing step.
- [ ] A route test sends an update as the author and as a moderator and proves no layer comes back unmarked.
- [ ] Updates to listings that are not Supporter-only reply as before.
