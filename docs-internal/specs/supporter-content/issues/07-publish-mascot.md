# 07: Client: publish a Mascot

Status: done
Blocked by: 06
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: high

Model rationale: wires the shared publish flow to a new source and renders a thumbnail from the rig.

## Parent

[spec.md](../spec.md) — Supporter Content and Mascot Listings.

## What to build

The Mascot tab gains Publish for a custom Mascot, through the shared publish flow. The thumbnail defaults to the card's Initial render; the author can replace it (Q24). A Mascot over 10 MB is refused before upload with its measured size (Q23). The author can update and delete the listing and write Listing Changelog entries like any other kind. The Default Mascot and Supporter content can't be published.

## Acceptance criteria

- [x] Publish sends the card data and the Initial render as the thumbnail; a replaced thumbnail is sent instead. (`FormaquestionMascotTab.publish.test.tsx`: sends the card data…, sends a replaced thumbnail…)
- [x] An over-cap Mascot shows its size and is not sent. (same file: shows the measured size…; `WorldStorageService.test.ts` at/over limit)
- [ ] Update replaces the listing's content; delete removes it. (Update: test "updates the listing the author picks". Delete is the existing trash button on the card; not exercised here.)
- [x] Publish is absent on the Default Mascot. (test "has no Publish on the Default Mascot")
- [x] Component tests cover publish, the thumbnail default and replace, and the size refusal.
- [ ] Frame `.scratch/frames/publish-mascot.png`, both themes, at 1440 wide.
- [x] The Mascot docs page covers publishing. (`docs/Formaquestion.md`, "Publish a Mascot")

## Landed

Rulings from the spec session: Q29 (Publish refuses a Mascot with bundled layers and names them) and Q30 (the author's Mascot links to its listing after publish).

**Not verified**
- Delete removes the listing: it uses the existing trash button on the card in the Mascots section; no test here.
- The frame `.scratch/frames/publish-mascot.png`: no dev route opens the publish dialog with a Mascot.
- Listing Changelog entry on a Mascot update: the shared modal path, no Mascot-specific test.

**For you**
- Open the Mascot tab signed in, select a custom Mascot with your own art, and select Publish. Check the Thumbnail section in both themes at 1440 wide.
- Also fixed: `isMascotCardImage` overflowed the regex stack on multi-MB images, so a large Mascot could not export or publish.
