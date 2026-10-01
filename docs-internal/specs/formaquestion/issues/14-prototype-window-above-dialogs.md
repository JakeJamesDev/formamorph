# 14: Prototype, the window above dialogs

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Fable 5.1 (`claude-fable-5-1`)
Reasoning effort: high

## What to build

A throwaway prototype answers two questions before any window ticket starts:

1. **Can a floating window stay usable while one of our dialogs is open (Q21)?** Our dialogs make everything outside them inert, trap focus and lock scroll. The prototype mounts one window at the app root and proves, in the real app with the real dialog components:
   - the player can click and type in the window while a dialog is open
   - the player can click and type in the dialog behind the window
   - Escape closes the top dialog and leaves the window open
   - a popover inside a dialog still opens above the dialog and works
   - nested dialogs still work
   - the window is in a sensible place in the tab order, and a screen reader does not see it as hidden
2. **What do the window and its button look like (Q13, Q22)?** Show the fixed button on the Main Menu, the World Editor and the game view, and the floating window with its three parts: conversation, search results, reader with a contents list. Show drag and resize. Show the mobile full-screen sheet as a static frame. Fake the content; no AI call and no docs index.

Use the `/prototype` workflow: its own worktree, branch and port. Follow the design system for everything that has a pattern already. List each thing that is a new pattern.

If the first approach to question 1 fails, try the dialog library's full option space before reporting a limit. Report what was tried.

Hand over with static frames in both themes and a Playwright run that proves each bullet of question 1. The user approves the look and the layering approach, or redirects. The approved decisions go into the spec as rulings, and the new patterns go to the design system as a proposal.

Recommended model rationale: the inert scope, focus trap and scroll lock of the dialog library are the largest technical risk of the effort.

## Acceptance criteria

- [ ] Each bullet of question 1 has a Playwright assertion that passes, or a written finding of what failed and what was tried
- [ ] The layering approach is written down in a few sentences that ticket 16 can build from
- [ ] Static frames show the button on three screens and the window in both themes, at a realistic viewport
- [ ] A static frame shows the mobile sheet
- [ ] Every new visual pattern is listed for approval
- [ ] No production file changes outside the prototype branch
- [ ] Status moves to `ready-for-human` for the user's approval
