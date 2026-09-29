# 02: Avatars in the Portrait Split Layout

Status: ready-for-human
Base: 3cc1df82
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

**Parent:** [Avatar Portrait Cards](../spec.md)

**What to build:** Community Creations frames Avatars as portraits, as it does entities (Q1). The kind-to-aspect switch returns portrait for `model`. So the Avatars grid uses split cards and split skeletons, and the details window puts the art beside the author, counts and actions. The profile creation rows move onto the same switch instead of their own entity check. Embedded images keep the top-anchored cover crop (Q3). The card text is the listing's credit line, and an empty one is fine (Q6).

## Acceptance criteria

- [ ] An Avatar listing renders the split card layout. A world still renders stacked.
- [ ] An Avatar's details window renders the portrait split header. The Avatar File license block still shows.
- [ ] The Avatars tab grid shows three per row on wide screens, two on medium and one on phones, and loads with split skeletons.
- [ ] Profile creation rows crop Avatar images as portraits.
- [ ] The existing card and details-window layout tests gain Avatar cases. Each guard is proven by reverting the switch.
- [ ] The design-system doc's Community Card rules name Avatars beside entities. The showcase reference gains an Avatar sample in the split layout.
- [ ] Checked in the preview at a real viewport, in both themes.
- [ ] Typecheck, lint, tests and build pass. Report the test wall time. Update the code graph. Add a 👤 changelog entry in the In Progress section.
