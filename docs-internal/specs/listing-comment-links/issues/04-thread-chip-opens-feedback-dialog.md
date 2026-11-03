# 04: Thread Chip Opens the Feedback Dialog

Status: ready-for-agent
Blocked by: 03
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium
Spec: ../spec.md (Q8; App and site)

Extends the shared Feedback dialog opener by one field. The dialog stacking above the listing modal is the part to watch.

## What to build

In the app, a plain click on a thread chip in a listing comment opens that thread in the shared Feedback dialog, bugs included. The dialog opens above the listing modal, and closing it returns the player to the listing. A modified click still follows the chip's address. A bug has no address, so its chip is a button. The website is unchanged.

## Acceptance criteria

- [ ] A plain click on a suggestion, question or bug thread chip opens that thread in the Feedback dialog. Test: the rendered modal with the Feedback host, with user events.
- [ ] Closing the Feedback dialog leaves the listing modal open, and focus returns to the chip. Test: the same render.
- [ ] Escape closes only the Feedback dialog. Test: the same render.
- [ ] A modified click on a suggestion chip leaves the browser's link. Test: user events.
- [ ] The existing Feedback dialog openers (Error Details, help) behave as before. Test: their existing tests stay green.
- [ ] Frame of the Feedback dialog above the listing modal, dark theme: `.scratch/frames/thread-chip-dialog-dark.png`.
