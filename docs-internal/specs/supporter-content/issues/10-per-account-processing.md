# 10: Server: per-account watermark and scramble on the gated route

Status: ready-for-agent
Repo: FormamorphServer
Blocked by: 04, 05, 09
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: high

Model rationale: wires two proven modules into the gated route and adds a revision-keyed cache.

## Parent

[spec.md](../spec.md) — Supporter Content and Mascot Listings.

## What to build

The gated route's processing hook watermarks each image layer with the account id (ticket 04), then scrambles it (ticket 05) with a per-account, per-revision seed. The response carries the seed and format version beside the content. The result is cached in the private area per account and revision, and dropped when the revision changes. Non-image content passes through unmarked.

## Acceptance criteria

- [ ] Every image layer of a Mascot served through the gated route unscrambles and reads back the requesting account's id.
- [ ] Two accounts get different seeds and different marks.
- [ ] A second request for the same revision is served from the cache; a new revision drops the old cache.
- [ ] The response carries the seed and format version.
- [ ] Non-image content passes through unchanged.
- [ ] Route tests cover each case above, and time the cold and cached request on Morphie-sized content.
