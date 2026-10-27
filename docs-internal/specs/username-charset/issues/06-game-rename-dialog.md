# 06: Game Rename Dialog

Status: done
Blocked by: 02, 03
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium
Spec: ../spec.md (Q12, Q16, Q17)

## What to build

A flagged player sees a rename dialog over the current view. It opens when the player signs in, or when the app starts with the player already signed in. The field starts with the server's suggestion. Any community-server reply with the `USERNAME_RENAME_REQUIRED` code opens the same dialog. When the player closes it, local play stays open, but account features stay refused until the rename. This ticket owns the shared client rename call. Ticket 07 reuses it.

## Acceptance criteria

- [x] The dialog opens from `usernameRename.required` at sign-in and at app start. `UsernameRenameDialog.test.tsx`: `opens at app start…`, `opens at sign-in, after Later held it…` (through `AuthService.login`); waits behind the Privacy Policy prompt and the sign-in dialog. Guards mutation-checked.
- [x] A refused reply with the code opens the dialog, the same way the Privacy Policy refusal opens its dialog. `watchPrivacyRefusals` became `watchRefusals(apiUrl, code, …)`; tests `opens again after Later…`, `…held payload predates the flag`, `stays closed when the fresh account owes no rename`.
- [x] The field is prefilled with the suggestion, or empty when the suggestion is `null`. `prefilled with the suggestion`, `starts empty…`, `takes the fresher suggestion when the boot profile read lands`.
- [x] The dialog uses ticket 02's rule and help text, and shows `USERNAME_TAKEN` as a "name taken" error. `shows the rule and sends nothing…`, `shows a taken name as taken`; `USERNAME_INVALID` maps to the help text too.
- [x] A successful rename refreshes the stored account and closes the dialog. `sends the trimmed name, stores the renamed account and closes` (memory and `localStorage`); the main menu header follows the stored account.
- [x] The dialog has a dev-route entry and follows the design system. `#dev?modal=usernameRename`, surface `usernameRename`; shadcn Dialog, paired footer, help line under the field.
- [x] Frames: `.scratch/frames/rename-dialog-light.png` and `.scratch/frames/rename-dialog-dark.png` at 1280 px wide. 1280×800 viewport, dev route.
- [x] The Community Creations wiki page describes the rename dialog. New section "Choose a New Username" under Your Account.
- [x] A changelog fragment describes the rename. `docs-internal/changelog.d/username-charset-06.md`, under the Usernames group.

## Landed

**Not verified**

- None unticked. The refused-write path runs against a stubbed server; ticket 04's gate is not live, so no real `USERNAME_RENAME_REQUIRED` reply was seen.

**For you**

- For you: the dialog's wording, and how it reads to a player who never chose to rename (the frames above). Frames: `.scratch/username-charset-06/frames/rename-dialog-light.png`, `.scratch/username-charset-06/frames/rename-dialog-dark.png`.
- A success toast, "Username changed to <name>", confirms the rename. No ruling asked for it; drop it if unwanted.
