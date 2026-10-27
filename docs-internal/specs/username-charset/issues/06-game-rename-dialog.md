# 06: Game Rename Dialog

Status: ready-for-agent
Blocked by: 02, 03
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium
Spec: ../spec.md (Q12, Q16, Q17)

## What to build

A flagged player sees a rename dialog over the current view. It opens when the player signs in, or when the app starts with the player already signed in. The field starts with the server's suggestion. Any community-server reply with the `USERNAME_RENAME_REQUIRED` code opens the same dialog. When the player closes it, local play stays open, but account features stay refused until the rename. This ticket owns the shared client rename call. Ticket 07 reuses it.

## Acceptance criteria

- [ ] The dialog opens from `usernameRename.required` at sign-in and at app start.
- [ ] A refused reply with the code opens the dialog, the same way the Privacy Policy refusal opens its dialog.
- [ ] The field is prefilled with the suggestion, or empty when the suggestion is `null`.
- [ ] The dialog uses ticket 02's rule and help text, and shows `USERNAME_TAKEN` as a "name taken" error.
- [ ] A successful rename refreshes the stored account and closes the dialog.
- [ ] The dialog has a dev-route entry and follows the design system.
- [ ] Frames: `.scratch/frames/rename-dialog-light.png` and `.scratch/frames/rename-dialog-dark.png` at 1280 px wide.
- [ ] The Community Creations wiki page describes the rename dialog.
- [ ] A changelog fragment describes the rename.

For you: the dialog's wording, and how it reads to a player who never chose to rename (the frames above).
