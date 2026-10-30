# 08: Moderation Show radio group

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium
Spec: ../spec.md (Rulings › Q24)

Model rationale: one popover rebuilt on existing radio, checkbox and separator components, with the browser's filter state and its tests adjusted.

## What to build

The Moderation popover becomes prototype variant B (spec Q24). A **Show** radio group picks one view: **All Listings**, **Quarantined (n)** or **Flagged Likes (n)**. Picking one clears the other, so Quarantined and Flagged Likes no longer combine. Below a divider, **Pin Pending** (the current Show Pending, renamed) stays a checkbox with its persisted value and its rule: disabled while Quarantined is picked. Counts sit right-aligned. A view with a zero count is disabled unless it is the one picked. The badge counts changes from the usual view: a view other than All Listings counts 1, Pin Pending off counts 1. On the contest tab the group holds All Listings and Flagged Likes, and Pin Pending is hidden. The empty-state line for "quarantined and flagged" goes away. The prototype on branch `prototype/moderation-popover` (`0ff89e76a`, `ModerationMenu.prototype.tsx`, `VariantB`) shows the target; rewrite it properly rather than copying it.

## Acceptance criteria

- [x] The popover shows a Show radio group with All Listings, Quarantined (n) and Flagged Likes (n), and Pin Pending as a checkbox under a divider. (test "lists the Show group and keeps Pin Pending apart from it"; preview frame)
- [x] Picking Quarantined or Flagged Likes narrows the list to it and clears the other; All Listings clears both. (tests "swaps to Quarantined…", "swaps back to Flagged Likes…")
- [x] A view with a zero count is disabled unless picked. (tests "disables Quarantined at zero…", "is disabled at zero rather than hidden")
- [x] Pin Pending keeps its stored value and is disabled while Quarantined is picked. (tests "stays off across a remount", "shows no group in the Quarantined view")
- [x] The badge counts a non-default view and Pin Pending off, and shows nothing in the usual view. (test "badges Pin Pending off and a view other than All Listings, one each")
- [x] On the contest tab only All Listings and Flagged Likes show, and Pin Pending is hidden. (contest test "pins nothing and offers no Pin Pending…")
- [x] Players and guests see none of it. (test "shows nothing to a player or a guest")
- [x] The existing browser tests that covered the AND of Quarantined and Flagged Likes now cover the exclusive pick. (pinnedReview "Flagged Likes" tests)
- [ ] Help tips and labels pass the `copy-sweep` skill.
- [x] Frames: `.scratch/frames/moderation-radio-dark.png`, `.scratch/frames/moderation-radio-light.png` at a realistic desktop width with the `likesMarker` fixture; `.scratch/frames/moderation-radio-mobile-dark.png` at 390px.

For you: open the popover as staff and check Pin Pending reads as separate from the Show choice.

## Landed

**Not verified**
- `copy-sweep` did not run. The tips are "Show every listing" and "Pin listings that wait for review above the results", as the spec session ruled.
- The preview frames use a 1280 px viewport scaled to 800 px by the pane.

**For you**
- Open the Moderation popover as staff and check Pin Pending reads as separate from the Show choice.
- On a catalog tab pick Quarantined, then open the contest tab: the radio reads All Listings and Quarantined returns on the way back.
