# 07: Site Rename Page

Status: ready-for-agent
Blocked by: 06
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium
Spec: ../spec.md (Q12, Q17)

## What to build

The account site has a rename page. A flagged account goes there after sign-in, and after any write refused with `USERNAME_RENAME_REQUIRED`. The page uses ticket 02's rule and ticket 06's rename call. After the rename, it returns to the account page.

## Acceptance criteria

- [ ] Sign-in of a flagged account lands on the rename page.
- [ ] A refused write with the code sends the session to the rename page.
- [ ] The field is prefilled with the suggestion, or empty when it is `null`.
- [ ] The page shows the rule error and the "name taken" error.
- [ ] A successful rename returns to the account page with the new name shown.
- [ ] Frames: `.scratch/frames/site-rename-light.png` and `.scratch/frames/site-rename-dark.png` at 1280 px and 375 px wide.
