# 07: Site Rename Page

Status: done
Blocked by: 06
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium
Spec: ../spec.md (Q12, Q17)

## What to build

The account site has a rename page. A flagged account goes there after sign-in, and after any write refused with `USERNAME_RENAME_REQUIRED`. The page uses ticket 02's rule and ticket 06's rename call. After the rename, it returns to the account page.

## Acceptance criteria

- [x] Sign-in of a flagged account lands on the rename page. `LoginPage.test.tsx`: "lands on the rename page after sign-in".
- [x] A refused write with the code sends the session to the rename page. `renameRefusal.test.ts`, three cases (code, other code, already on the page).
- [x] The field is prefilled with the suggestion, or empty when it is `null`. `RenamePage.test.tsx`, two cases.
- [x] The page shows the rule error and the "name taken" error. `RenamePage.test.tsx`, two cases.
- [x] A successful rename returns to the account page with the new name shown. `RenamePage.test.tsx`: `leaveTo('/account')`, then the layout notice reads "Username changed to Ann_Lee".
- [x] Frames: 1280 px and 375 px, light and dark: `.scratch/frames/site-rename-light.png`, `site-rename-dark.png`, `site-rename-light-375.png`, `site-rename-dark-375.png`.

## Landed

**Not verified**

- None unticked. No real `USERNAME_RENAME_REQUIRED` reply was seen: ticket 04's gate is not live, so the refusal runs against a stubbed `Response`. The frames use a stubbed `/auth/me` on the site dev server.

**For you**

- For you: the page's wording, and how it reads to a player who never chose to rename. Frames: `.scratch/username-charset-07/frames/site-rename-light.png`, `.scratch/username-charset-07/frames/site-rename-dark.png`, `.scratch/username-charset-07/frames/site-rename-light-375.png`, `.scratch/username-charset-07/frames/site-rename-dark-375.png`.
- The site shows "Username changed to <name>" as a banner on the account page, in the style of the deletion-canceled banner. The ticket asked for no notice; drop it if unwanted.
- New route `/rename` is in `hosting/_redirects`. It goes live with the next site deploy.
