# 17: Server: version the per-account cache and clear it on erasure

Status: needs-triage
Repo: FormamorphServer
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Model rationale: a cache-key change plus one cleanup hook, with route tests.

## Parent

[spec.md](../spec.md) — Supporter Content and Mascot Listings. Found by the close review.

## What to build

Per-account cache files are named by listing, revision and account only. A change to the watermark or scramble keeps serving copies made by the old code at the same revision; ticket 14 changed the mark after ticket 10 added the cache. Account erasure also leaves that account's cache files in the private area.

## Acceptance criteria

- [ ] The cache key includes a processing version that changes whenever the watermark or scramble output changes; an old-version file is never served.
- [ ] Erasing an account deletes its cache files.
- [ ] Deleting a listing deletes its cache files (ticket 10 For-you).
- [ ] Route tests cover each case.
