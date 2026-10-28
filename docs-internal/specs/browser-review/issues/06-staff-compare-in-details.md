# 06: Staff Compare In Details

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Model note: one visibility condition and one prop
Reasoning effort: low

## What to build

In the listing details modal, staff see the **Pending Update** section with **Compare**, so they can check an update before they approve. **Discard Update** stays author-only.

## Acceptance criteria

- [ ] Staff who are not the author see the Pending Update section and can open Compare.
- [ ] Staff who are not the author see no **Discard Update** button.
- [ ] The author still sees the section with **Discard Update**.
- [ ] A non-staff viewer who is not the author sees no section.
- [ ] Frames: `.scratch/frames/staff-compare-light.png` at 1280px wide.
