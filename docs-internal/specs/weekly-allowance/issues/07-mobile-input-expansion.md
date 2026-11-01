# 07: Mobile Input Expansion

Status: ready-for-agent
Blocked by: 06
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Model rationale: focus-driven layout in one row, with the existing focus state to build on.

**What to build:** on mobile widths, the focused action input expands over Help and the Allowance Ring, and Send stays visible. Leaving the input brings them back.

- [ ] On a mobile width, focusing the input hides Help and the ring, and Send stays present and enabled. Test through the GamePanels harness.
- [ ] Blur restores both, and the input's text stays.
- [ ] The ring stays hidden while expanded, even at or above the highest warning.
- [ ] Tapping Send while focused sends the action. Send doesn't move when the input collapses, proven by a DOM read of its position.
- [ ] Desktop widths keep Help and the ring visible while the input has focus.
- [ ] Attach Images doesn't change.
- [ ] Frames at `.scratch/frames/07-input-focused-375.png` and `.scratch/frames/07-input-blurred-375.png`.
- [ ] A changelog fragment covers the expansion.

For you: try typing and sending on the Android build, where the on-screen keyboard shapes the row.
