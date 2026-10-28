# 10: Server: per-account watermark and scramble on the gated route

Status: done
Base: 0fab6d4
Repo: FormamorphServer
Blocked by: 04, 05, 09
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: high

Model rationale: wires two proven modules into the gated route and adds a revision-keyed cache.

## Parent

[spec.md](../spec.md) — Supporter Content and Mascot Listings.

## What to build

The gated route's processing hook watermarks each image layer with the account's mark number, from ticket 04's helper (Q27),, then scrambles it (ticket 05) with a per-account, per-revision seed. The response carries the seed and format version beside the content. The result is cached in the private area per account and revision, and dropped when the revision changes. Non-image content passes through unmarked.

## Acceptance criteria

- [x] Every image layer of a Mascot served through the gated route unscrambles to exactly `embed(source, mark)` for the requesting account (spec Q38; `unscrambles to the source marked for the requesting account, for every layer`: 26 Morphie layers plus the Initial render, compared byte for byte).
- [x] Two accounts get different seeds and different marks. (`gives two accounts different seeds and different marks`)
- [x] A second request for the same revision is served from the cache; a new revision drops the old cache. (`serves a second request for the same revision from the cache` (cache file swapped for a sentinel); `drops the old revision's cache when the revision changes`)
- [x] The response carries the seed, format version and original size of each layer (Q34). (`carries the seed, format version and original size beside each layer`)
- [x] Scrambled layers are encoded losslessly, so unscrambling restores the marked layer exactly. (the same byte-for-byte comparison, on PNG)
- [x] Non-image content passes through unchanged. (`passes everything that is not an image through unchanged`, and `leaves a string that only looks like an image ... as they were`)
- [x] The staff review content route serves a flagged listing marked for the reviewing account, as ticket 09 wired it through the hook. (two tests: a first-review listing and a held update, each marked for the reviewing admin; held content is not cached)
- [x] Route tests cover each case above, and time the cold and cached request on Morphie-sized content. (`tests/supporterProcessing.test.js`, 11 tests; cold about 1.4 s, cached 5 to 130 ms; guards proven by breaking cache read, old-revision cleanup and `embed`)

## Landed

**Not verified**

- The mark does not always read back. With no route involved, `read(embed(layer, mark))` returned null for 1 of 312 random (mark, Morphie layer) pairs; example: mark 2145859145 on `tests/fixtures/morphie/arms-no-thinking.webp`. It also fails after scramble and PNG, so the route adds no loss. The route test therefore asserts equality with `embed(source, mark)`, not `read` (spec Q38). Ticket 14 owns the fix.

**For you**

- A deleted listing leaves its cached per-account files in the private area. They hold scrambled, marked copies only; nothing sweeps them yet.
- Concurrent first requests from one account both process the content; the last write wins. Same bytes, so harmless.
- A layer that does not decode as an image passes through unmarked, as sent.
