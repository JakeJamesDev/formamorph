# 03: Pinned Review Group

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Model note: splits the browser's client-side filter, sort and page pipeline
Reasoning effort: high

## What to build

In Community Creations, staff see every listing that awaits review pinned above the normal results, with a **Show Pending** toggle for the player view. Cards have no check or X yet. See the spec's **Browser pipeline** and **Show Pending** modules.

## Acceptance criteria

- [ ] Staff see new, resubmitted and Update Pending listings in one pinned group above page 1, oldest-queued first, regardless of the browser's sort.
- [ ] A non-staff viewer never sees a new or resubmitted pending listing; the test fails when the staff guard is removed.
- [ ] The pinned group follows kind, search and filters.
- [ ] The pinned group shows on page 1 only and does not shrink the page.
- [ ] An Update Pending listing shows once: in the pinned group, not also in its normal slot.
- [ ] With **Show Pending** off, staff get the player view: new pending listings are hidden and updates sit in their normal slot with their live face.
- [ ] **Show Pending** is on by default, shows only for staff, and survives a remount.
- [ ] The Quarantined view shows no pinned group.
- [ ] A `devRoutes` entry opens the staff browser with a pinned group from the dev review stub.
- [ ] A changelog fragment adds the 👤 User-facing → Added entry for staff review in Community Creations.
- [ ] Frames: `.scratch/frames/pinned-group-light.png` and `.scratch/frames/pinned-group-dark.png` at 1280px wide.

For you: open the dev route and judge whether the pinned group reads as separate from the normal results.
