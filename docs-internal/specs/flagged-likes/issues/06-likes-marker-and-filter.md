# 06: Likes Marker and Flagged Likes option

Status: ready-for-agent
Blocked by: 02, 04
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium
Spec: ../spec.md (Implementation Decisions › Client)

Model rationale: a staff-only marker on two existing surfaces and one more option in ticket 02's popover, against ticket 04's API.

## What to build

A staff-only **Likes Marker** shows on the community browser card and in the listing details of every marked listing, on every tab including contests. It names which reason fired (Burst, flagged share, or both). Pressing it opens **Audit the likes** for that listing. The Moderation popover gains **Flagged Likes (n)**: disabled at zero, narrowing together with Quarantined, sending the staff-only filter to the catalog.

## Acceptance criteria

- [ ] Staff see the marker on marked cards and in their details; players and guests never do.
- [ ] The marker names its reason or reasons.
- [ ] Pressing the marker opens the likes audit for that listing.
- [ ] The marker shows on contest entries for staff.
- [ ] Flagged Likes shows its count, is disabled at zero, and its filter reaches the catalog request.
- [ ] Flagged Likes and Quarantined on together request both filters.
- [ ] A dev-route entry shows a marked card for a staff user.
- [ ] Frames: `.scratch/frames/likes-marker-card-dark.png`, `.scratch/frames/likes-marker-card-light.png`, `.scratch/frames/likes-marker-details-dark.png` at a realistic desktop width; `.scratch/frames/likes-marker-card-mobile-dark.png` at 390px.

For you: browse as staff and check the marker is noticeable without crowding the card.
