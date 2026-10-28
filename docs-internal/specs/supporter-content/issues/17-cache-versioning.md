# 17: Server: version the per-account cache and clear it on erasure

Status: done
Base: 4f1788b
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

- [x] The cache key includes a processing version that changes whenever the watermark or scramble output changes; an old-version file is never served. (Hash of `watermark.js`, `scramble.js` and the seed label; test "never serves a copy made under another processing version")
- [x] Erasing an account deletes its cache files. (Test "deletes only the erased account's files when a Supporter is erased")
- [x] Deleting a listing deletes its cache files (ticket 10 For-you). (Tests for owner delete, author erasure with content, quarantine expiry, and clearing the Supporter-only flag, per Q43)
- [x] Route tests cover each case. (Six tests in "the cache lifecycle"; each failed when its clear call or the version was removed)

## Landed

**Not verified**
- A processing-version change from an edit to `supporterProcessing.js` itself (PNG encoding) does not bump the version. The hash covers only the watermark, the scramble and the seed label, per Q43.
- A request that writes a cache file while its listing is being deleted can leave one file behind. Not tested.

**For you**
- None.
