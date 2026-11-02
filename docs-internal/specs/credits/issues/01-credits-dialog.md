# 01: Credits Dialog

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

A contained swap of one dialog and its surface entries. The prominence rule is the only subtle part.

## What to build

The Main Menu footer line reads **Credits**, and it opens a general Credits dialog in place of the icon dialog. On mobile the line keeps its slot in the ⋯ menu. The dialog has a tab list with one tab, **Credits**, which names Jake James, FieryLionite, the Game Icons authors and, on desktop, llama.cpp, all at one size. The Game Icons entry keeps the site, the license and the note that icons draw in the theme's colors.

This ticket owns the dialog and its tab list. Tickets 02 and 04 add one tab each and build no second frame. Use `Tabs`, because each tab has a real panel.

The surface ID, label, route, Help map entry and dev route move from `iconCredits` to `credits`, and the dev route takes a `tab`.

Rulings: Q1, Q2, Q3, Q14, Q17.

## Acceptance criteria

- [x] The footer line reads **Credits** at the size of the copyright and origin lines, and it opens the dialog. Tested on the real Main Menu. `MainMenu.credits.test.tsx`; computed font size is 12px on the button and its row.
- [x] The ⋯ menu row opens the same dialog on mobile. `MainMenu.credits.test.tsx`, mobile case.
- [x] The dialog opens on the Credits tab with every name from `ITEM_ICON_AUTHORS`. Removing an author from the tab fails a test. `CreditsDialog.test.tsx` reads each name from the panel; cutting the author list made two tests fail.
- [x] All credited names render with one text style. `CreditsDialog.test.tsx`, one class set on three names.
- [x] The Game Icons site and CC BY 3.0 links are present. `CreditsDialog.test.tsx`, link hrefs.
- [x] The llama.cpp line shows only under the desktop check, tested both ways. `CreditsDialog.test.tsx`.
- [x] No `iconCredits` ID or `ICON_CREDIT_LINE` remains in source. `credits` resolves in the surface label, route, Help map and dev route. Grep of `src` and `docs`; `devRouter.test.ts` and the surface tests pass.
- [x] The How to Play topic becomes **Credits**, with keywords that keep "who made the icons" answerable. `docs/How-to-Play.md`; the docs tests pass.
- [x] A changelog fragment is added. `docs-internal/changelog.d/credits-01.md`.
- [x] Frames at 1366 and 375, both themes: `.scratch/frames/credits-dialog-light.png`, `.scratch/frames/credits-dialog-dark.png`, `.scratch/frames/credits-mobile.png`.

For you: the footer line and the Credits tab's wording, in the frames above.

## Landed

**Not verified**
- None. The frames hide the tutorial popover and an event notice that the preview raises on its own.

**For you**
- The footer line and the Credits tab's wording, in `.scratch/credits-01/frames/credits-dialog-light.png`, `.scratch/credits-01/frames/credits-dialog-dark.png` and `.scratch/credits-01/frames/credits-mobile.png`.
