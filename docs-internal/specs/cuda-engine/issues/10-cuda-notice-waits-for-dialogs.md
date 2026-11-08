# 10: CUDA Notice Waits For Dialogs

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: low

Model rationale: one condition in the main menu, with an existing test file.

## What to build

The ticket 08 ruling says the main-menu CUDA notice "waits until the intro, the AI setup, the first-run step and any open dialog close". Today the notice waits for the intro, the age gate, the AI setup gate and the first-run step, but not for other open dialogs. Found in the close review.

The main menu is a shared file: stage it through a filtered patch.

## Acceptance criteria

- [x] With any main-menu dialog open, the notice doesn't show, and it shows once the dialog closes. (test "waits while a modal dialog is open anywhere, then shows once it closes")
- [x] A guard test fails when the dialog check is removed. (removed `modalOpen` from the hold condition: that test failed; restored)

## Landed

**Not verified**
- Real Radix dialogs in the live app: the test uses a plain `role="dialog"` element. Radix sets `role="dialog"` and `data-state`, which the selector reads.

**For you**
- Open Settings or Load Game on the main menu on a CUDA-offerable machine with the offer still unseen: the card should stay hidden until the dialog closes.
