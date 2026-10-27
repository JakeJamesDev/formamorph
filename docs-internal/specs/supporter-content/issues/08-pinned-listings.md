# 08: Client: pinned listings and staff Pin toggle

Status: ready-for-agent
Blocked by: 03
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Model rationale: an ordering rule and a staff control in the existing browser.

## Parent

[spec.md](../spec.md) — Supporter Content and Mascot Listings. Owns the staff listing controls that ticket 13 extends.

## What to build

Pinned listings show first in their kind's section and in All, newest pin first, before the player's sort (Q16). A pinned card carries a Pinned mark. Staff see a Pin or Unpin control on every listing.

## Acceptance criteria

- [ ] Pinned listings come first under every sort and filter in a section and in All.
- [ ] A pinned card shows the Pinned mark.
- [ ] Only staff see the Pin control; it pins and unpins and the order updates.
- [ ] Component tests cover the order and the staff-only control.
- [ ] Frame `.scratch/frames/pinned-listing.png`, both themes, at 1440 wide.
