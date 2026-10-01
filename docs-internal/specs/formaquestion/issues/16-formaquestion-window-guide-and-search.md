# 16: Formaquestion window, guide and search

Status: ready-for-agent
Blocked by: 14, 15
Recommended model: Claude Fable 5.1 (`claude-fable-5-1`)
Reasoning effort: high

## What to build

A player can open **Formaquestion** on every screen, browse the full guide and search it, with no AI. This is the first shippable slice of the window.

- A fixed button sits at the same place on every screen. F1 opens and closes the window (Q22). F1 does nothing while the tutorial holds the keyboard.
- The window floats above every dialog and stays usable while a dialog is open (Q21). Build the layering approach that ticket 14 proved, and the look the user approved there.
- The player can move and resize the window. Position and size are remembered on the device in browser storage, wrapped so a blocked storage does not break the window. The window stays inside the screen after a browser resize.
- **Contents:** a list of every docs page and its sections (Q25).
- **Reader:** shows a section as formatted markdown. A link to another docs page opens in the reader. A link to an outside site opens in the browser.
- **Search:** the player types words and gets ranked sections, each with its page and heading. A click opens the section in the reader.
- The window stays open and keeps its state when the player changes screens.
- A new docs page describes Formaquestion itself, so the window's own surface passes the coverage test.
- The window gets a dev-router entry. The button and the window get design-system entries for the patterns the user approved.

This ticket does not build the ask field, the mobile sheet or the "help for this screen" jump. On mobile sizes the button is hidden until ticket 17.

Recommended model rationale: the layering against the dialog library and the shared root placement touch every screen; a mistake here breaks dialogs app-wide.

## Acceptance criteria

- [ ] The button shows on the Main Menu, the World Editor and the game view, and F1 toggles the window on each
- [ ] Playwright: with Settings open, the player types in the window's search field, then types in a Settings field, then presses Escape; Settings closes and the window stays
- [ ] Playwright: a popover inside a dialog still opens and works while the window is open
- [ ] Drag and resize work; position and size survive a reload; the window returns inside the screen after a resize
- [ ] The contents list shows every indexed page; a click shows the section
- [ ] Search shows ranked sections for a query and an empty state for no match
- [ ] An in-docs link opens in the reader; an outside link opens in the browser
- [ ] Unmount leaves no timer or listener behind; the test run exits 0
- [ ] `verify-ui` evidence in both themes at a realistic viewport
- [ ] Changelog line under In Progress
- [ ] Four gates green
