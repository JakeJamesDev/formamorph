# 07: Client: publish a Mascot

Status: ready-for-agent
Blocked by: 06
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: high

Model rationale: wires the shared publish flow to a new source and renders a thumbnail from the rig.

## Parent

[spec.md](../spec.md) — Supporter Content and Mascot Listings.

## What to build

The Mascot tab gains Publish for a custom Mascot, through the shared publish flow. The thumbnail defaults to the card's Initial render; the author can replace it (Q24). A Mascot over 10 MB is refused before upload with its measured size (Q23). The author can update and delete the listing and write Listing Changelog entries like any other kind. The Default Mascot and Supporter content can't be published.

## Acceptance criteria

- [ ] Publish sends the card data and the Initial render as the thumbnail; a replaced thumbnail is sent instead.
- [ ] An over-cap Mascot shows its size and is not sent.
- [ ] Update replaces the listing's content; delete removes it.
- [ ] Publish is absent on the Default Mascot.
- [ ] Component tests cover publish, the thumbnail default and replace, and the size refusal.
- [ ] Frame `.scratch/frames/publish-mascot.png`, both themes, at 1440 wide.
- [ ] The Mascot docs page covers publishing.
