# 06: Staff Compare In Details

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Model note: one visibility condition and one prop
Reasoning effort: low

## What to build

In the listing details modal, staff see the **Pending Update** section with **Compare**, so they can check an update before they approve. **Discard Update** stays author-only.

## Acceptance criteria

- [x] Staff who are not the author see the Pending Update section and can open Compare. Test: "lets staff compare, without Discard Update".
- [x] Staff who are not the author see no **Discard Update** button. Same test.
- [x] The author still sees the section with **Discard Update**. Test: "keeps Discard Update for the author".
- [x] A non-staff viewer who is not the author sees no section. Test: "is not offered to a viewer who is neither the author nor staff".
- [ ] Frames: `.scratch/frames/staff-compare-light.png` at 1280px wide.

## Landed

**Not verified**
- Frame `staff-compare-light.png`: not taken. The modal has no dev route for a staff viewer with a pending update.

**For you**
- Open a listing with a pending update as a mod in the details modal. Check that Pending Update shows with Compare and no Discard Update.
