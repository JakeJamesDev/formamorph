# World Editor Header Search

Status: done
Status note: Closed 2026-10-07. Tickets 01-06 landed; last landing 2d6a1474, review fixes 4a22da38. Closed without gates.
Spec session: world-editor-header-search — spec

Prototype: branch `prototype/editor-header-search`, final commit `0251aaf2`. Launch entry `proto-editor-header-search` (port 5251), `?variant=B`. Variant B (Grow In Place) won over A (Drop Panel) and C (Header Strip). Where this spec and the prototype differ, this spec wins: Escape focus, the mobile Overview footer, lazy search targets and the removed unsaved dot were ruled after the prototype.

## Problem Statement

The World Editor's header and footer spend space badly, most of all on phones.

- On desktop, Find is a small icon in the app bar's center. Searching the world takes a click or Ctrl+F before any typing, and the center of the bar holds two loose icons.
- The header shows "Saved" or "Unsaved changes" beside the title. The Save button already shows that state: it is enabled only when there is something to save. The header never names the world being edited.
- Each list has a box that reads "Search or add new entities". With world search in the header, two boxes would both say "search" and do different things.
- On Entities and Dictionary, an **Add Entity** or **Add Dictionary** split button takes its own place in the footer, beside **Save to Library**. The **+** beside the list box already adds to the same list.
- On mobile, the footer wraps to two rows: the add and library buttons, then Optimize Images and a labeled Save.
- On mobile, a selected item's detail opens under the list's + and box row, which takes height and does nothing while the detail is open.

## Solution

**Desktop app bar**
- Left: back, **World Editor**, a 12px muted chevron, then the world's name in the body role, muted. The name truncates with "…" before it reaches the search field. A world with a blank name shows the title alone.
- Center: a **Search World** field that searches as you type, with no Find to open first.
- Right: the Mode Select, a divider, the world actions (Export World as an icon in Simple, the **More world actions** menu in Advanced), the Test Bench flask, then Save.

**The docked search field**
- It holds a search icon, the field, a match counter, Previous Match and Next Match, and an expand button.
- Enter goes to the next match, Shift+Enter to the previous one.
- Ctrl+F focuses the field. Ctrl+H focuses it and expands it. Ctrl+F while the bar is expanded focuses the expanded field and leaves it expanded.
- Expanding grows today's full Find and Replace bar over the header, from the field's position. The field's slot keeps its width, so the header never reflows. The expanded bar always shows the replace row and the match location.
- The expanded bar's collapse button folds it back and moves focus to the collapsed field.
- Escape and **Clear search** clear the search, collapse the bar and drop the match marker. Focus returns to the control the author was in before Ctrl+F or Ctrl+H. When the author clicked or tabbed into the field instead, focus stays in the cleared field.
- Match Case and Match Whole Word stay on after the bar collapses. While collapsed, the field shows an icon for each option that is on. Selecting that icon expands the bar.

**Mobile**
- Header: back, the Mode Select, then the Test Bench and Search at the far right. Search opens today's floating find bar.
- Footer, left: **Save to Library** on Entities and Dictionary. Every other tab, Overview included, leaves the left side empty.
- Footer, right: the world actions (the Export World icon in Simple, the **More world actions** menu in Advanced), then an icon-only Save.
- Selecting an item opens its detail over the list's + and filter row.

**Lists (both layouts)**
- Each World Editor list box reads "Filter" and the plural of what the list holds: **Filter Stats**, **Filter Entities**, **Filter Locations**, **Filter Traits**, **Filter Dictionaries**, **Filter Placeholders**. Typing still names the item the + adds.
- The + is always a menu on Entities and Dictionary, in Simple mode too.
  - Entities: Add Group (Advanced only), Add Entity, a divider, **Add From Library…**, **Import Entity…**.
  - Dictionary: Add Dictionary, a divider, **Add From Library…**, **Import Dictionary…**.
- The **Add Entity** and **Add Dictionary** split buttons are removed. **Save to Library** stays where it is.

## User Stories

1. As an author on desktop, I want a search field in the header, so that I can search the world by typing without opening Find first.
2. As an author, I want the match count in the search field, so that I know how many hits my query has.
3. As an author, I want Previous Match and Next Match in the field, so that I can step through hits without expanding anything.
4. As an author, I want Enter and Shift+Enter to step through matches, so that I can search from the keyboard.
5. As an author, I want Escape to clear and collapse the search, so that I can get back to editing quickly.
6. As an author who pressed Ctrl+F in a field, I want Escape to return me to that field, so that I keep my place.
7. As an author who clicked into the search field, I want Escape to leave me in the cleared field, so that focus does not jump somewhere I did not choose.
8. As an author, I want Ctrl+F to focus the header field, so that the shortcut I already know still works.
9. As an author, I want Ctrl+H to open the full Find and Replace bar, so that I can replace text from the keyboard.
10. As an author, I want an expand button on the field, so that I can reach the match options and replace when I need them.
11. As an author, I want the expanded bar to grow over the header, so that the header and panels below never shift.
12. As an author, I want the expanded bar to show the replace row at once, so that expanding gets me to replace in one step.
13. As an author, I want the expanded bar to show where the current hit is, so that I know which tab, item and field it is in.
14. As an author, I want a collapse button in the expanded bar, so that I can fold it back to the small field and keep typing.
15. As an author, I want Match Case and Match Whole Word to stay on after I collapse the bar, so that my next search behaves the same way.
16. As an author, I want an icon in the collapsed field for each option that is on, so that I know my search is filtered.
17. As an author, I want to select that icon to expand the bar, so that I can turn the option off quickly.
18. As an author, I want the search field not to take focus when the editor opens, so that the first key I press goes where I expect.
19. As an author editing a large world, I want an empty search field to cost nothing, so that typing in the editor stays fast.
20. As an author, I want the world's name in the header, so that I know which world I am editing.
21. As an author, I want a long world name to end with "…" before the search field, so that the header stays on one row.
22. As an author, I want the name and its separator to read as secondary to the title, so that the header keeps a clear hierarchy.
23. As an author, I want the Save button to be the one place that shows save state, so that the header does not repeat it.
24. As an author on desktop, I want the Test Bench next to Save, so that the world-level tools sit together on the right.
25. As an author, I want each list box to say Filter and what the list holds, so that I do not confuse it with world search.
26. As an author, I want typing in the filter box to still name the item the + adds, so that quick adding works as before.
27. As an author, I want Add From Library in the + menu, so that every way to add to a list starts from the same button.
28. As an author, I want Import Entity and Import Dictionary in the + menu, so that adding from a file is next to the other adds.
29. As an author in Simple mode, I want the + menu to show Add Entity and the library routes, so that Simple mode can also add from my library.
30. As an author, I want Save to Library to stay in the footer, so that what I do with the selected item stays where it was.
31. As an author on mobile, I want Search and the Test Bench at the right edge of the header, so that they are in thumb reach.
32. As an author on mobile, I want the Mode Select beside Back, so that the header keeps one row at 360px.
33. As an author on mobile, I want Save as an icon in the bottom-right corner, so that the footer fits on one row.
34. As an author on mobile, I want the world actions beside Save, as on desktop, so that I find Export World and Optimize Images in the same place.
35. As an author on mobile Overview, I want Export World to show once, so that the footer has no duplicate control.
36. As an author on mobile, I want a selected item's detail to cover the + and filter row, so that the detail gets the full height.
37. As an author on mobile, I want Back in the detail to return me to the list with its + and filter row, so that I can add or filter again.
38. As a keyboard and screen-reader user, I want every control in the field to have an accessible name, so that I know what each one does.
39. As a new author in the Authoring Tour, I want the add step to tell me to choose Add Entity in the + menu, so that the step matches what I see.
40. As an author asking Morphie for help, I want answers that name the new controls, so that the steps match the screen.

## Implementation Decisions

- **One find bar component, two layouts.** The existing find bar gains a docked layout for the desktop app bar. Matching, replace, placeholder replace, confirmation and notices are shared. The floating layout stays for mobile. The docked layout takes `expanded` with a change callback and a focus signal for Ctrl+F. It keeps its own query and option state across expand and collapse.
- **Expanded state lives in the World Editor.** Ctrl+H sets it, the field's expand and collapse buttons change it, and Escape and Clear search reset it.
- **Ctrl+H between tickets 04 and 05.** Until the expand lands, desktop Ctrl+H acts as Ctrl+F, and replace is reachable only on mobile. Main is unreleased, so no player sees that gap. No floating-bar stopgap on desktop. (Ruled 2026-10-07 for ticket 04; superseded when ticket 05 landed, where Ctrl+H expands.)
- **Find open state is mobile only.** On desktop, Ctrl+F and Ctrl+H never set it, so a window resized from desktop to mobile does not mount the floating bar.
- **Search targets are collected only while the docked query has text.** An empty field collects nothing and costs nothing on world edits. Mobile keeps collecting while its bar is open.
- **Focus rules.**
  - The docked layout never takes focus when it mounts.
  - Expanding and collapsing move focus to the field of the layout now shown. The expanded bar replaces the collapsed field, so focus would otherwise be lost.
  - Ctrl+F and Ctrl+H record the control focused before them, unless the focus was already in the search.
  - Escape and Clear search return focus to that control when it is still connected. Otherwise focus stays in the cleared field.
  - The recorded control is dropped when Escape or Clear search runs, and when focus leaves the search (the field and the expanded bar).
  - These rules replace the floating bar's fallback to the editor root on desktop. Mobile keeps that fallback.
- **Narrow desktop widths.** The Surface App Bar becomes a three-column grid: equal columns that never shrink the end group below its content. The search field shrinks to a floor of about 10rem, stays centered at 1024px and wider, and moves off center only when space runs out; nothing overlaps. The world name still truncates. The Design System's center-line rule changes to "on the center line when space allows, never overlapping the sides". Only the World Editor and its isolated reference use the bar; Community Creations has its own header. (User ruling 2026-10-07 for ticket 04; landed in `0665ba96` as three equal columns, field 10–26rem.)
- **The overlay keeps its slot.** The expanded bar is positioned over the header, 36rem wide and centered on the field. The field's slot keeps its height and width.
- **Accessible names.**
  - The field: "Search World", the same as its placeholder. The expanded bar's search input carries the same name, since the query carries across (landed in ticket 05).
  - The expand button: "Show options and replace", with the tooltip "Show options and replace (Ctrl+H)".
  - The option icon: "Show match options".
  - The expanded bar's collapse button: "Collapse to search".
  - Its close button: "Clear search".
  - The existing names stay: "Previous match", "Next match", "Match case", "Match whole word". The mobile Save icon's name is "Save".
  - The copy sweep reviews these names against the Writing Guide.
- **List adds move into the + menu.** The Entities and Dictionary list adapters take extra + menu rows from the World Editor host, because the library picker and the file import are host state. Both adapters always return a menu, in Simple mode too.
- **Filter wording.** The six World Editor list adapters change their box text to "Filter <plural of what the list holds>". The Entity Editor and Dictionary Editor modals keep "Search or add new …"; they have no header search. Lists nested inside World Editor panels also read "Filter …": the Traits mirror on the Entities tab reads "Filter Traits" (keeping entity-traits-mirror Q25), and the scoped Placeholders section reads "Filter Placeholders". Their shared editors take the text from the host and keep the modals' wording as the default. (Ruled 2026-10-07 for ticket 01.)
- **Header title.** The save-state text is removed. The world name comes from the overview's name, trimmed; a blank name renders nothing. The chevron is the same icon the find bar's match location uses. A cut-off name shows its full text in the shared tooltip on hover.
- **Mobile footer.** The world actions control is the same one desktop uses. The Overview export action leaves the mobile footer, because the world actions already hold Export World. On a wrap, the world actions and Save stay right-aligned. Save has no unsaved dot. Its enabled state is the only signal, as on desktop.
- **Authoring Tour.** The `add-entity` step body changes to tell the author to select **Add Entity** in the + menu. The `list-add`, `save` and `test-bench` anchors move with their controls.
- **Take Me There.** The `find-button` target names the docked field on desktop and the Search button on mobile. The Find and Replace help topic keeps its route.
- **Design System.** The Surface App Bar pattern changes in its rules, composition, state reference, isolated reference and writing review:
  - The tools on the center line become the search field. The Test Bench moves to the surface actions.
  - The save-state status is removed. The title is followed by the world's name, and the rule "never the open item's name" is rewritten: the world is the surface's subject, not an open item.
  - The isolated reference drops its Never Stored, Saved and Unsaved Changes choice.
  - The Compact Find Utility Bar pattern gains the docked field and the expanded overlay.
- **Glossary.** The List Editor entry changes "a search box with the **+** control" to "a filter box with the **+** control (a search box in the Entity Editor and Dictionary Editor modals)".
- **Help docs.** These docs change to the new controls:
  - The World Editor page: its Find and Replace topic (magnifier, **Find** box, replace row) and its two save-state lines.
  - The Entities, Dictionary and Linked Content pages, and the built-in help topics, where they name the **Add Entity** or **Add Dictionary** button.
  - The Locations and Stats pages, where they name the "Search or add new …" box.
- **Verification route.** The dev-router gets a way to open the World Editor with the docked bar expanded, for the static-frame check.

## Testing Decisions

- A good test drives the World Editor as an author would, by role and accessible name, and asserts what the author sees. It never asserts class names or internal state.
- The highest seam is the rendered World Editor in jsdom through `renderWorldEditorBench` in `src/test/worldEditorBench.tsx`, with its `asMobile` helper for the mobile layout. Most behavior is tested there:
  - typing in Search World navigates to a hit and shows the counter;
  - an empty field collects no search targets;
  - Ctrl+F focuses the field, Ctrl+H expands it with the replace row, and Ctrl+F while expanded stays expanded;
  - options stay on across collapse, and the indicator shows them and expands the bar;
  - Escape after Ctrl+F returns focus to the earlier field; Escape after a click leaves focus in the cleared field;
  - the field does not take focus on mount;
  - the + menu on Entities and Dictionary holds the library and import rows in both modes, and each one opens its picker or file import;
  - the header shows the world name and no save-state text, and a blank name shows no separator;
  - on mobile, the detail hides the + and filter row, the footer holds the world actions and Save, and Overview shows Export World once.
- `EditorFindBar.test.tsx` keeps the floating layout's cases and gains docked cases only where the World Editor cannot reach them.
- Prior art: `WorldEditor.appBar.test.tsx`, `WorldEditor.headerRow.test.tsx`, `WorldEditor.listToolbar.test.tsx`, `WorldEditor.findFocus.test.tsx`, `WorldEditor.inPlayMobile.test.tsx`, `WorldEditor.tourEntities.test.tsx`. The effort added `WorldEditor.findExpand.test.tsx` (the expanded bar) and `WorldEditor.mobileFooter.test.tsx` (the phone footer and detail).
- Tests that change with the behavior:
  - The save-state cases in `WorldEditor.appBar.test.tsx` are removed, because the save-state text is removed. This removes a behavior, not an assertion on a kept behavior.
  - `WorldEditor.headerRow.test.tsx` asserts the new mobile order.
  - `WorldEditor.findFocus.test.tsx`'s case for opening Find from the header button becomes the docked field's focus cases.
  - `WorldEditor.landing.test.tsx`'s `find-button` landing follows the new target.
  - `WorldEditor.libraryLinks.test.tsx` reaches Add From Library through the + menu.
  - `WorldEditor.tourEntities.test.tsx` follows the new step body.
  - Tests that query "Search or add new …" by placeholder change to "Filter …". This is a copy change, not a weakened assertion.
- The Playwright suite is outside the gates. Run its World Editor specs once if they touch the header.

## Out of Scope

- Variants A (Drop Panel) and C (Header Strip).
- Moving **Save to Library** out of the footer.
- A docked search field on mobile. Mobile keeps the search button and the floating bar.
- Changing find and replace behavior: matching, placeholder replace, chip skips, and the Replace All confirmation.
- The Entity Editor and Dictionary Editor modals' list boxes.
- Other surfaces' app bars.

## Further Notes

- The docked search field and its overlay are a new visual pattern. The user approved variant B on 2026-10-06 after reviewing all three variants in the prototype.
- The prototype committed nothing to the main branch. Its code was written under prototype rules: rewrite it properly here, and do not cherry-pick it.
- No export shape changes.
