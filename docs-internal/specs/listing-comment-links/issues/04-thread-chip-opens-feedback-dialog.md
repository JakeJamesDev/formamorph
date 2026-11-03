# 04: Thread Chip Opens the Feedback Dialog

Status: done
Blocked by: 03
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium
Spec: ../spec.md (Q8; App and site)

Extends the shared Feedback dialog opener by one field. The dialog stacking above the listing modal is the part to watch.

## What to build

In the app, a plain click on a thread chip in a listing comment opens that thread in the shared Feedback dialog, bugs included. The dialog opens above the listing modal, and closing it returns the player to the listing. A modified click still follows the chip's address. A bug has no address, so its chip is a button. The website is unchanged.

## Acceptance criteria

- [x] A plain click on a suggestion, question or bug thread chip opens that thread in the Feedback dialog. Test: the rendered modal with the Feedback host, with user events. (`RemoteWorldDetailsModal.threadChip.test.tsx`, three cases)
- [x] Closing the Feedback dialog leaves the listing modal open, and focus returns to the chip. Test: the same render. (Back case)
- [x] Escape closes only the Feedback dialog. Test: the same render. (Escape case)
- [x] A modified click on a suggestion chip leaves the browser's link. Test: user events. (Ctrl-click case)
- [x] The existing Feedback dialog openers (Error Details, help) behave as before. Test: their existing tests stay green. (`ErrorDetailsReportBug`, `Formaquestion.askCommunity` green)
- [ ] Frame of the Feedback dialog above the listing modal, dark theme: `.scratch/frames/thread-chip-dialog-dark.png`.

## Landed

**Not verified**
- The dark-theme frame: no dev-router route opens a listing modal with comments and thread targets, so no frame exists. Stacking is covered by the test (both dialogs present, Escape and Back close only the Feedback one), not by a rendered frame.

**For you**
- Open a listing comment with a `#N` chip in the app: the Feedback dialog should sit above the listing, in both themes.
- Back on a chip-opened thread closes the dialog (spec ruling). An unsent draft stays and shows on the next open.
- Focus returns to the chip through `document.activeElement`. Safari does not focus a clicked link, so check focus there.
