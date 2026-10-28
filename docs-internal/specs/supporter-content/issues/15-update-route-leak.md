# 15: Server: no raw Supporter content in the update reply

Status: done
Base: 4f1788b
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

- [x] An update to a Supporter-only listing returns no unprocessed content: either no `contentData`, or content passed through the per-account processing step. Reply omits `contentData`, held updates included; `tests/supporterOnly.test.js` "the update reply".
- [x] A route test sends an update as the author and as a moderator and proves no layer comes back unmarked. "carries no content for the author or a moderator"; marker string absent from the reply text. Guard removed: both new guard tests failed.
- [x] Updates to listings that are not Supporter-only reply as before. Control test "still carries the content on a listing that is not Supporter-only".

## Landed

**Not verified**
- None.

**For you**
- Client check: the only PUT path is `WorldStorageService.publishItem` (`WorldStorageService.ts:1265`), called from `PublishModal.tsx:226`. It reads only `id`, `_id` and `updated_at` from the reply, so no caller reads `contentData`. The spec session's pointer to line 966 is the comment-edit method, not this path.
- POST create left unchanged (spec Q43): a new listing is never Supporter-only yet.
