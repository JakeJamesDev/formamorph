# 01: Credits Dialog

Status: ready-for-agent
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

- [ ] The footer line reads **Credits** at the size of the copyright and origin lines, and it opens the dialog. Tested on the real Main Menu.
- [ ] The ⋯ menu row opens the same dialog on mobile.
- [ ] The dialog opens on the Credits tab with every name from `ITEM_ICON_AUTHORS`. Removing an author from the tab fails a test.
- [ ] All credited names render with one text style.
- [ ] The Game Icons site and CC BY 3.0 links are present.
- [ ] The llama.cpp line shows only under the desktop check, tested both ways.
- [ ] No `iconCredits` ID or `ICON_CREDIT_LINE` remains in source. `credits` resolves in the surface label, route, Help map and dev route.
- [ ] The How to Play topic becomes **Credits**, with keywords that keep "who made the icons" answerable.
- [ ] A changelog fragment is added.
- [ ] Frames at 1366 and 375, both themes: `.scratch/frames/credits-dialog-light.png`, `.scratch/frames/credits-dialog-dark.png`, `.scratch/frames/credits-mobile.png`.

For you: the footer line and the Credits tab's wording, in the frames above.
