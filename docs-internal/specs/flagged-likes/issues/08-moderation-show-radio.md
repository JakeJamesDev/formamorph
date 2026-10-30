# 08: Moderation Show radio group

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium
Spec: ../spec.md (Rulings › Q24)

Model rationale: one popover rebuilt on existing radio, checkbox and separator components, with the browser's filter state and its tests adjusted.

## What to build

The Moderation popover becomes prototype variant B (spec Q24). A **Show** radio group picks one view: **All Listings**, **Quarantined (n)** or **Flagged Likes (n)**. Picking one clears the other, so Quarantined and Flagged Likes no longer combine. Below a divider, **Pin Pending** (the current Show Pending, renamed) stays a checkbox with its persisted value and its rule: disabled while Quarantined is picked. Counts sit right-aligned. A view with a zero count is disabled unless it is the one picked. The badge counts changes from the usual view: a view other than All Listings counts 1, Pin Pending off counts 1. On the contest tab the group holds All Listings and Flagged Likes, and Pin Pending is hidden. The empty-state line for "quarantined and flagged" goes away. The prototype on branch `prototype/moderation-popover` (`0ff89e76a`, `ModerationMenu.prototype.tsx`, `VariantB`) shows the target; rewrite it properly rather than copying it.

## Acceptance criteria

- [ ] The popover shows a Show radio group with All Listings, Quarantined (n) and Flagged Likes (n), and Pin Pending as a checkbox under a divider.
- [ ] Picking Quarantined or Flagged Likes narrows the list to it and clears the other; All Listings clears both.
- [ ] A view with a zero count is disabled unless picked.
- [ ] Pin Pending keeps its stored value and is disabled while Quarantined is picked.
- [ ] The badge counts a non-default view and Pin Pending off, and shows nothing in the usual view.
- [ ] On the contest tab only All Listings and Flagged Likes show, and Pin Pending is hidden.
- [ ] Players and guests see none of it.
- [ ] The existing browser tests that covered the AND of Quarantined and Flagged Likes now cover the exclusive pick.
- [ ] Help tips and labels pass the `copy-sweep` skill.
- [ ] Frames: `.scratch/frames/moderation-radio-dark.png`, `.scratch/frames/moderation-radio-light.png` at a realistic desktop width with the `likesMarker` fixture; `.scratch/frames/moderation-radio-mobile-dark.png` at 390px.

For you: open the popover as staff and check Pin Pending reads as separate from the Show choice.
