# 07: Mobile Input Expansion

Status: ready-for-human
Blocked by: 06
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Model rationale: focus-driven layout in one row, with the existing focus state to build on.

**What to build:** on mobile widths, the focused action input expands over Help and the Allowance Ring, and Send stays visible. Leaving the input brings them back.

- [x] On a mobile width, focusing the input hides Help and the ring, and Send stays present and enabled. Test through the GamePanels harness. (`GamePanels.mobileInput.test.tsx`: "hides Help and the ring on focus and keeps Send enabled")
- [x] Blur restores both, and the input's text stays. ("restores both on blur and keeps the typed text")
- [x] The ring stays hidden while expanded, even at or above the highest warning. (the test state is at 95%, past the 90% highest threshold)
- [x] Tapping Send while focused sends the action. Send doesn't move when the input collapses, proven by a DOM read of its position. ("sends the action when Send is tapped while focused"; jsdom has no layout, so that test reads DOM order, and the browser pane read Send at x=310.3, y=755.3 blurred and focused at 375 px)
- [x] Desktop widths keep Help and the ring visible while the input has focus. ("keeps Help and the ring on a desktop width while the input has focus")
- [x] Attach Images doesn't change. (the button and its props are untouched in the diff)
- [x] Frames at `.scratch/frames/07-input-focused-375.png` and `.scratch/frames/07-input-blurred-375.png`.
- [x] A changelog fragment covers the expansion. (`docs-internal/changelog.d/weekly-allowance-07.md`)

For you: try typing and sending on the Android build, where the on-screen keyboard shapes the row.

## Landed

**Not verified**
- None. The Send position is a layout read in a desktop browser at 375 px, not on a device.

**For you**
- Try typing and sending on the Android build, where the on-screen keyboard shapes the row.
