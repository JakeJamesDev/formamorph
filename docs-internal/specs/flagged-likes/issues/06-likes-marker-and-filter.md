# 06: Likes Marker and Flagged Likes option

Status: ready-for-human
Blocked by: 02, 04
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium
Spec: ../spec.md (Implementation Decisions › Client)

Model rationale: a staff-only marker on two existing surfaces and one more option in ticket 02's popover, against ticket 04's API.

## What to build

A staff-only **Likes Marker** shows on the community browser card and in the listing details of every marked listing, on every tab including contests. It names which reason fired (Burst, flagged share, or both). Pressing it opens **Audit the likes** for that listing with the audit already loaded, so the summary and Bursts from ticket 05 show without a second press. The Moderation popover gains **Flagged Likes (n)**: disabled at zero, narrowing together with Quarantined. Like Quarantined, it narrows and counts locally over the loaded catalog, reading each staff row's `likes_marker`; the server has no filter param. The details modal reads `likes_marker` from the single-listing response. Flagged Likes applies on the contest tab, so the Moderation button shows there again; ticket 02 gates the button and its mobile wrapper on `staffHere`, which this ticket widens.

## Acceptance criteria

- [x] Staff see the marker on marked cards and in their details; players and guests never do. (`RemoteWorldCard.likesMarker.test.tsx`, details cases in `RemoteWorldDetailsModal.likers.test.tsx`)
- [x] The marker names its reason or reasons. (card test: Burst, and both)
- [x] Pressing the marker opens the likes audit for that listing. (browser test sees the audit call for that id; details test sees `auditOnOpen`)
- [x] The marker shows on contest entries for staff. (contest test: staff yes, player no)
- [x] Flagged Likes shows the count of loaded rows with a non-empty `likes_marker`, is disabled at zero, and narrows the list to them. (pinnedReview tests)
- [x] Flagged Likes and Quarantined on together show only listings that are both. (pinnedReview AND test)
- [ ] On the contest tab the Moderation button shows with Flagged Likes only, on desktop and mobile.
- [x] A dev-route entry shows a marked card for a staff user. (`#dev?modal=community&fixture=likesMarker`)
- [x] Carried from ticket 05: the staff dev fixture opens the likes audit with seeded rows covering all three kinds and one Burst; frames `.scratch/frames/audit-kinds-dark.png` and `.scratch/frames/audit-kinds-light.png` at a realistic desktop width; the audit's badge tips, summary and Burst copy pass the `copy-sweep` skill. (`npm run copy:sweep` shows no notice on the audit's strings)
- [x] Frames: `.scratch/frames/likes-marker-card-dark.png`, `.scratch/frames/likes-marker-card-light.png`, `.scratch/frames/likes-marker-details-dark.png` at a realistic desktop width; `.scratch/frames/likes-marker-card-mobile-dark.png` at 390px. (all stored)

For you: browse as staff and check the marker is noticeable without crowding the card.

## Landed

**Not verified**

- On the contest tab the Moderation button shows with Flagged Likes only, on desktop and mobile: a contest test pins desktop; mobile has no test (jsdom has no mobile layout) and no frame. The mobile wrapper gate uses the same condition as desktop.
- No contest-tab frame; contest entries are covered by tests only.

**For you**

- Browse as staff and check the marker is noticeable without crowding the card: `.scratch/flagged-likes-06/frames/likes-marker-card-dark.png`, `.scratch/flagged-likes-06/frames/likes-marker-card-light.png`, `.scratch/flagged-likes-06/frames/likes-marker-card-mobile-dark.png`.
- Check the marker text reads well in light mode: normal text with a warning-colored flag icon, in `.scratch/flagged-likes-06/frames/likes-marker-card-light.png`.
