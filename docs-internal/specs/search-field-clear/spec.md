# Search Field Clear

Status: done
Status note: Closed 2026-10-07. Tickets 01-05 done; last landing 7ae5fac8. Closed without gates.
Spec session: search-field-clear — spec

Rulings from the grill session are Q-numbered. A settled ruling reopens on new evidence, never on a new opinion.

## Problem Statement

Search, find, and filter boxes across the app have no way to empty themselves in one action. The author selects the text and deletes it, or backspaces through it. The feedback lists have a clear X; nothing else does. Two boxes show Chromium's native cancel button and the rest show nothing, so the same kind of control looks and acts differently from screen to screen.

## Solution

Every search, find, and filter text box ends with a clear X while it holds text. Selecting the X empties the box, applies the empty search at once, and puts the cursor back in the box. Every such box also starts with a search icon. The X and the icon look the same everywhere.

The World Editor's docked **Search World** field gets the X in both its collapsed and expanded forms. Its row-end button is a close: it folds the bar and empties the query, and is named **Close Search**.

## User Stories

1. As an author, I want an X at the end of a search box, so that I can empty it in one click.
2. As an author, I want the X to show only when the box holds text, so that an empty box has no dead control.
3. As an author, I want the cursor back in the box after I clear it, so that I can type the next search at once.
4. As an author, I want the list to show everything again when I clear a filter, so that the clear and the result agree.
5. As an author, I want the X to look and sit the same in every box, so that I learn it once.
6. As an author, I want every search box to open with a search icon, so that I can tell a search box from a text field.
7. As an author, I want the Find bar's text box and its Replace box to clear with an X, so that I can start a new find without selecting the old text.
8. As an author, I want the X to sit before the match toggles in the Find bar, so that the toggles stay where they were.
9. As an author, I want the X in the Community browser to clear my typed text without removing filter chips I already made, so that a clear is not a reset of the whole filter.
10. As an author, I want the X in **Find a Location** to clear the text and the highlighted row together, so that the list is not stuck on a stale selection.
11. As an author, I want the X in a picker's filter to clear the filter and any "blocked" note, so that the picker is back to its starting state.
12. As a moderator, I want the X in the Manage Users and Audit Log search to clear the box and show the unfiltered list, so that I do not also have to submit.
13. As a player, I want the X in the Traits tab filter and the Memory Manager search, so that in-game filters clear the same way as editor filters.
14. As an author, I want the X in the Guide search, so that I can start a new help search without selecting the old text.
15. As an author, I want the X in the Library additions search and the Add From Library search, so that library browsing clears the same way.
16. As an author, I want the X in a dropdown picker's search (multi-select, breadcrumb picker, trait requirements, variable menu, stat code templates), so that popover pickers clear the same way.
17. As a keyboard user, I want Enter in a dropdown picker to still select the highlighted item while I am typing, so that the X does not change how the picker works.
18. As a screen-reader user, I want the X named **Clear Search** everywhere, so that I hear one name for one action.
19. As a screen-reader user, I want the Find bar's existing clear button named the same way, so that two buttons for the same action do not have two names.
20. As an author on a mobile device, I want the X to take no space until I type, so that a narrow search box keeps its width for text.
21. As an author, I want Escape to keep doing what it does today, so that a dialog still closes and the Find bar still collapses.
22. As an author, I want the native browser cancel button gone from every search box, so that no box shows two X's.
23. As a contributor, I want one shared search field component, so that the next search box gets the X for free.
24. As a contributor, I want the pattern in the Design System with a live reference, so that I can check the approved look before building a new search box.

## Implementation Decisions

- **Q1 Scope.** All seventeen live search, find, and filter boxes get the X, the docked **Search World** field included. (Revised by Q14: the exclusion rested on the row-end button's label, not on a clear-text control.)
- **Q2 Build.** A new shared `SearchField` component owns the wrapper, the leading icon, the input, and the X. It builds on a `FieldWithTrailing` primitive extracted from the Find bar: a relative wrapper with a focus-within ring that hosts trailing cells. The base `Input` stays a bare input element. Around forty call sites size `Input` directly through its class list, so a wrapper on `Input` would break flex and grid sizing.
- **Q3 Visibility.** The X renders only while the value is non-empty. No slot is reserved when the box is empty.
- **Q4 Submit fields.** On the submit-based Manage Users and Audit Log searches, the X empties the box and runs the empty search at once, so the list shows unfiltered.
- **Q5 Icon.** Every search field shows the leading search icon. Five boxes that have none today gain it: the editor list toolbars, Memory Manager, Add From Library, Find a Group, and the drill picker. The Find bar's floating and expanded Find box is the one exception and stays without an icon (ruled at review).
- **Q6 Label.** The X's accessible name is **Clear Search** in AP title case. The Find bar's row-end button is a close, not a clear: it renames from "Clear search" to **Close Search** when docked and from "Close find" to **Close Find** when floating, with its tests, its Design System lines, and the World Editor docs. (Revised with Q14.)
- **Q7 Slot order.** Where a box has other trailing controls, the X follows any cell whose width changes with the text (a match counter) and precedes fixed cells (match toggles, previous and next, mode swap). The X then keeps one position while the author types. In a box with only fixed cells it is the innermost cell. The input's right padding grows by one cell while the X shows. (Revised at review: the first form put the X before the counter, and it moved with every count.)
- **Q8 Focus and Escape.** Clearing returns focus to the input. Escape is not bound by the component. Dialog close and Find bar collapse keep Escape. The Guide search keeps swallowing it.
- **Q12 Native Escape clear.** Chromium empties a non-empty `type="search"` input on Escape by default, and hiding the cancel pseudo-element does not stop it. `SearchField` calls `preventDefault` on Escape so the native clear never runs and only the host behavior fires (Radix listens on document capture, so a dialog still closes). The feedback search loses its Escape-clears behavior; the X is the clear. The Guide no longer needs its own Escape handler.
- **Q14 Docked boxes.** The collapsed app-bar field and the expanded bar's Find box both get the inner X. In the collapsed field it follows the options badge and the counter and precedes the match navigation (Q7 revised); in the expanded bar, before the match toggles. The expanded bar is one JSX block shared with the floating bar, forked on `docked` for labels and behavior.
- **Q15 Replace box.** Its X is named **Clear Replace**, shows in both layouts, and only in text mode. The placeholder picker gets none.
- **Q13 Changelog.** Tickets 02 to 05 write no fragment. Ticket 01's lead covers the effort. A fragment always lands as its own entry, so a shared lead cannot be folded.
- **Q9 cmdk pickers.** In the command-palette pickers the X is mouse-only with `tabIndex -1`. The Command root handles Enter by selecting the highlighted item, and a focusable X would turn Enter into a selection. Backspace already clears for keyboard users. The breadcrumb picker's input is uncontrolled, so its X reads the search through cmdk's command-state hook.
- **Q10 Process.** Spec plus tickets at this folder.
- **Q11 Docs.** A **Search Field** pattern in the Design System and a `SearchFieldReference` on the showcase, with a dev route.
- **Native cancel.** The component hides the WebKit search cancel pseudo-element on every `type="search"` input it renders. No test relies on the native button.
- **Clear side state.** `onClear` defaults to calling `onChange` with an empty string. Hosts that carry side state pass their own `onClear`: Community keeps its filter chips and clears only the typed text through its existing apply path; Find a Location resets the active row; the drill picker drops its blocked note; the shared list toolbar calls its search model's `clear`.
- **Class split.** `className` styles the wrapper; `inputClassName` styles the input. This mirrors the feedback search input's existing split.
- **Height variants.** The component accepts the input `size` variant so the compact Traits tab and drill picker fields keep their height. The icon and the X scale with the variant.
- **Migration order.** The feedback search input migrates first. Its tests are the regression net for the shared behavior: name, immediate empty search on clear, `type="search"` kept for the searchbox role, max length, timer cancel on unmount, outside value replaces text.
- **Custom hosts.** The floating Find and Replace boxes add the X as a `FieldWithTrailing` cell. The game debug search adds it as the first cell of its existing right-aligned group. The command input gets it inside its input wrapper.

## Testing Decisions

- A good test drives the component the way a user does: type, see the X, select it, see the empty value, the callback, and the focus. It never reads internal state or class names, except for the one assertion that the native cancel button is hidden.
- **Seam one: `SearchField`.** One test file covers the shared behavior once: X absent when empty, present with text, `onClear` default and override, refocus after clear, the **Clear Search** name, the searchbox role, the size variant.
- **Seam two: one host test per surface** that the X clears the host's own state. Community: chips survive, typed text goes. Find a Location: the active row resets. Drill picker: the blocked note goes. Manage Users and Audit Log: the unfiltered list loads. Find bar: the inner X clears without collapsing in both layouts, and the row-end button's new names. cmdk: Enter still selects while the X shows.
- **Prior art.** The feedback search tests, the World Editor find-expand tests, the Find bar reference tests, the multi-select tests, and the design-system reference tests for the showcase entry.
- The feedback search input's focus return after clear is untested today. Add that case in the migration.
- A guard must bite: for the cmdk Enter case, prove the test fails with a focusable X before shipping the mouse-only one.

## Out of Scope

- The docked **Search World** field's collapse and focus-return behavior.
- Binding Escape to clear.
- A reserved X slot or a disabled X on empty fields.
- Text fields that are not search, find, or filter boxes.
- The account site, which has no search inputs.
- Any change to what a search matches.

## Further Notes

- The inventory found seventeen live boxes. Five share one editor list toolbar, five share one command input, and the rest are single boxes.
- Visual change from Q5 lands on five boxes. Check both themes on the showcase reference.
- One changelog entry covers the effort, under Minor → Added → 👤, written by ticket 01 (Q13).
